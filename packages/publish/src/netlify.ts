import { z } from "zod";
import { manifestOf } from "./manifest.js";
import { uploadOrder } from "./order.js";
import {
  type BuildOutput,
  PublishError,
  type PublishErrorCode,
  type PublishEvent,
  type Publisher,
  type TestResult,
  throwIfCancelled,
} from "./publisher.js";

// Netlify publishing (research 08, spec/04 item 0.2) over its REST API, without the Netlify SDK:
// a file-digest deploy sends every file's SHA-1, Netlify answers with the digests it doesn't have,
// and only those files are uploaded. Every response is validated with zod (standards: zod at
// every network boundary). See https://docs.netlify.com/api/get-started/.

/** Netlify's API. */
export const NETLIFY_API = "https://api.netlify.com/api/v1";

/** A Netlify publish profile's settings, stored in the `.wforge` file (no secrets). */
export type NetlifyDestination = {
  readonly siteId: string;
};

/** How to reach Netlify. */
export type NetlifyOptions = {
  /** A personal access token or an OAuth access token. Never logged or put in messages. */
  readonly token: string;
  /** Injectable for tests; defaults to the global `fetch`. */
  readonly fetch?: typeof fetch;
  readonly apiBase?: string;
  /** How often to check whether a deploy is live, and for how long. */
  readonly pollIntervalMs?: number;
  readonly pollTimeoutMs?: number;
  /** First retry delay after a network error or a 5xx; doubles each time. Default 1 s. */
  readonly retryBaseMs?: number;
};

/** Retries per request after a 429, a network error or a 5xx. */
const MAX_RETRIES = 3;
/** The longest we wait before a retry, whatever Netlify's headers ask for. */
const MAX_RETRY_DELAY_MS = 60_000;

const siteSchema = z.object({
  id: z.string(),
  name: z.string(),
  /** The site's live address, e.g. `https://rosas-bakery.netlify.app`. */
  ssl_url: z.string().nullish(),
  url: z.string().nullish(),
});

/** A Netlify site, as far as Webforge needs it. */
export type NetlifySite = z.infer<typeof siteSchema>;

const deploySchema = z.object({
  id: z.string(),
  site_id: z.string(),
  /** `preparing`, `prepared`, `uploading`, `uploaded`, `processing`, `ready`, `error`, … */
  state: z.string(),
  /** SHA-1 digests of the files Netlify still needs. */
  required: z.array(z.string()).nullish(),
  ssl_url: z.string().nullish(),
  url: z.string().nullish(),
  /** This deploy's own permanent address. */
  deploy_ssl_url: z.string().nullish(),
  created_at: z.string().nullish(),
  error_message: z.string().nullish(),
});

/** A Netlify deploy. */
export type NetlifyDeploy = z.infer<typeof deploySchema>;

const formSchema = z.object({
  id: z.string(),
  name: z.string(),
  paths: z.array(z.string()).nullish(),
  fields: z.array(z.object({ name: z.string() })).nullish(),
});

/** A form Netlify detected in a deploy. */
export type NetlifyForm = z.infer<typeof formSchema>;

const userSchema = z.object({ id: z.string() });

/** The HTTP status codes Netlify uses, mapped to what the app tells the user. */
function codeForStatus(status: number): PublishErrorCode {
  if (status === 401 || status === 403) return "unauthorized";
  if (status === 404) return "not-found";
  if (status === 429) return "rate-limited";
  if (status === 400 || status === 422) return "rejected";
  return "failed";
}

/** Encodes a site path for a URL, segment by segment (`#` and `?` must not end the path). */
function encodePath(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/");
}

function wait(ms: number, signal: AbortSignal | undefined): Promise<void> {
  return new Promise((resolve, reject) => {
    const cancel = () => {
      clearTimeout(timer);
      reject(new PublishError("cancelled", "Publishing was cancelled"));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", cancel);
      resolve();
    }, ms);
    if (signal?.aborted === true) cancel();
    else signal?.addEventListener("abort", cancel, { once: true });
  });
}

/**
 * How long to wait before retrying `response`: Netlify's `Retry-After` (seconds) or
 * `X-RateLimit-Reset` (Unix time) when given, else exponential backoff from `baseMs`.
 */
function retryDelay(response: Response | null, attempt: number, baseMs: number): number {
  const retryAfter = Number(response?.headers.get("Retry-After") ?? Number.NaN);
  const reset = Number(response?.headers.get("X-RateLimit-Reset") ?? Number.NaN);
  const ms = Number.isFinite(retryAfter)
    ? retryAfter * 1000
    : Number.isFinite(reset)
      ? reset * 1000 - Date.now()
      : baseMs * 2 ** attempt;
  return Math.min(Math.max(ms, 0), MAX_RETRY_DELAY_MS);
}

/** A small, typed client for the Netlify endpoints Webforge uses. */
export function netlifyClient(options: NetlifyOptions) {
  const doFetch = options.fetch ?? fetch;
  const base = options.apiBase ?? NETLIFY_API;
  const retryBaseMs = options.retryBaseMs ?? 1_000;

  async function request<T>(
    method: string,
    path: string,
    schema: z.ZodType<T>,
    init: { body?: unknown; bytes?: Uint8Array; signal?: AbortSignal | undefined } = {},
  ): Promise<T> {
    throwIfCancelled(init.signal);
    const headers: Record<string, string> = { Authorization: `Bearer ${options.token}` };
    let body: Uint8Array | string | undefined;
    if (init.bytes !== undefined) {
      headers["Content-Type"] = "application/octet-stream";
      body = init.bytes;
    } else if (init.body !== undefined) {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(init.body);
    }
    // Messages name the request, never the token or file contents.
    const what = `${method} ${path.split("?")[0]}`;
    // GET and PUT (file uploads) are safe to repeat; a POST that failed with a 5xx may have
    // happened, so only a 429 (refused before doing anything) retries it.
    const repeatable = method === "GET" || method === "PUT";
    let response: Response;
    for (let attempt = 0; ; attempt++) {
      try {
        response = await doFetch(`${base}${path}`, {
          method,
          headers,
          ...(body === undefined ? {} : { body }),
          ...(init.signal === undefined ? {} : { signal: init.signal }),
        });
      } catch (error) {
        throwIfCancelled(init.signal);
        if (!repeatable || attempt >= MAX_RETRIES) {
          throw new PublishError("network", `Netlify could not be reached (${what})`, {
            cause: error,
          });
        }
        await wait(retryDelay(null, attempt, retryBaseMs), init.signal);
        continue;
      }
      if (response.ok) break;
      const retry =
        response.status === 429 || (repeatable && response.status >= 500 && response.status < 600);
      if (!retry || attempt >= MAX_RETRIES) {
        throw new PublishError(
          codeForStatus(response.status),
          `Netlify answered ${response.status} to ${what}`,
        );
      }
      await wait(retryDelay(response, attempt, retryBaseMs), init.signal);
    }
    const parsed = schema.safeParse(await response.json().catch(() => undefined));
    if (!parsed.success) {
      throw new PublishError("failed", `Netlify sent an unexpected response to ${what}`, {
        cause: parsed.error,
      });
    }
    return parsed.data;
  }

  const site = (siteId: string) => `/sites/${encodeURIComponent(siteId)}`;
  const deploy = (deployId: string) => `/deploys/${encodeURIComponent(deployId)}`;

  return {
    /** The signed-in user; fails with `unauthorized` if the token is invalid. */
    currentUser: (signal?: AbortSignal) => request("GET", "/user", userSchema, { signal }),
    listSites: (signal?: AbortSignal) =>
      request("GET", "/sites?filter=all", z.array(siteSchema), { signal }),
    getSite: (siteId: string, signal?: AbortSignal) =>
      request("GET", site(siteId), siteSchema, { signal }),
    /** Creates a site; Netlify picks a random name if `name` is not given or taken. */
    createSite: (name?: string, signal?: AbortSignal) =>
      request("POST", "/sites", siteSchema, { body: name === undefined ? {} : { name }, signal }),
    /** Starts a file-digest deploy; `files` maps `/path` to SHA-1. */
    createDeploy: (siteId: string, files: Record<string, string>, signal?: AbortSignal) =>
      request("POST", `${site(siteId)}/deploys`, deploySchema, { body: { files }, signal }),
    getDeploy: (deployId: string, signal?: AbortSignal) =>
      request("GET", deploy(deployId), deploySchema, { signal }),
    uploadFile: (deployId: string, path: string, data: Uint8Array, signal?: AbortSignal) =>
      request("PUT", `${deploy(deployId)}/files/${encodePath(path)}`, z.unknown(), {
        bytes: data,
        signal,
      }),
    listDeploys: (siteId: string, signal?: AbortSignal) =>
      request("GET", `${site(siteId)}/deploys`, z.array(deploySchema), { signal }),
    /** Makes an earlier deploy live again (rollback). */
    restoreDeploy: (siteId: string, deployId: string, signal?: AbortSignal) =>
      request(
        "POST",
        `${site(siteId)}/deploys/${encodeURIComponent(deployId)}/restore`,
        deploySchema,
        { signal },
      ),
    /** Forms Netlify detected in the site's deploys (Netlify Forms, B6). */
    listForms: (siteId: string, signal?: AbortSignal) =>
      request("GET", `${site(siteId)}/forms`, z.array(formSchema), { signal }),
  };
}

/** The client returned by {@link netlifyClient}. */
export type NetlifyClient = ReturnType<typeof netlifyClient>;

/**
 * Publishes to Netlify with a file-digest deploy: only files Netlify doesn't already have are
 * uploaded (assets first, `index.html` last), then the deploy goes live atomically. Netlify keeps
 * every deploy, so an earlier one can be restored with {@link NetlifyClient.restoreDeploy}.
 */
export function netlifyPublisher(options: NetlifyOptions): Publisher<NetlifyDestination> {
  const client = netlifyClient(options);
  const pollIntervalMs = options.pollIntervalMs ?? 1_000;
  const pollTimeoutMs = options.pollTimeoutMs ?? 120_000;

  return {
    async test(dest, signal): Promise<TestResult> {
      try {
        await client.getSite(dest.siteId, signal);
        return { ok: true };
      } catch (error) {
        if (error instanceof PublishError) return { ok: false, code: error.code };
        throw error;
      }
    },

    async *publish(build: BuildOutput, dest, signal): AsyncGenerator<PublishEvent> {
      yield { type: "preparing" };
      const manifest = manifestOf(build.files);
      const digests = Object.fromEntries(
        Object.entries(manifest.files).map(([path, digest]) => [`/${path}`, digest]),
      );
      const created = await client.createDeploy(dest.siteId, digests, signal);

      // Netlify lists digests, not paths; files with the same content are uploaded once.
      const required = new Set(created.required ?? []);
      const toUpload: string[] = [];
      for (const path of uploadOrder(build.files.keys())) {
        const digest = manifest.files[path];
        if (digest !== undefined && required.delete(digest)) toUpload.push(path);
      }
      for (const [done, path] of toUpload.entries()) {
        yield { type: "uploading", path, done, total: toUpload.length };
        const data = build.files.get(path);
        if (data !== undefined) await client.uploadFile(created.id, path, data, signal);
      }

      let deploy = created;
      const deadline = Date.now() + pollTimeoutMs;
      while (deploy.state !== "ready") {
        if (deploy.state === "error") {
          throw new PublishError("rejected", "Netlify could not process the deploy");
        }
        if (Date.now() > deadline) {
          throw new PublishError("failed", "Netlify did not finish the deploy in time");
        }
        await wait(pollIntervalMs, signal);
        deploy = await client.getDeploy(created.id, signal);
      }

      yield {
        type: "published",
        url: deploy.ssl_url ?? deploy.url ?? deploy.deploy_ssl_url ?? "",
        uploaded: toUpload.length,
        unchanged: build.files.size - toUpload.length,
        // A Netlify deploy is a whole new version of the site: files it lacks are simply gone.
        removed: 0,
      };
    },
  };
}
