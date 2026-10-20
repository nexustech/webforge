import { sha1 } from "./manifest.js";

// An in-memory stand-in for the Netlify endpoints netlifyClient uses, as an injectable `fetch`.
// It keeps state like the real service: content Netlify already has is not required again, a
// deploy goes live once every required file is uploaded, and old deploys can be restored.

type FakeDeploy = {
  id: string;
  site_id: string;
  files: Record<string, string>;
  required: string[];
  state: string;
  created_at: string;
};

export const FAKE_TOKEN = "test-token";
export const FAKE_CLIENT_ID = "webforge-test-client";

export function fakeNetlify() {
  const sites = new Map<string, { id: string; name: string; current: string | null }>();
  const deploys = new Map<string, FakeDeploy>();
  const blobs = new Map<string, Uint8Array>();
  const requests: { method: string; path: string }[] = [];
  const failures: {
    method: string;
    pattern: RegExp;
    status: number | "network";
    headers: Record<string, string>;
  }[] = [];
  let ids = 0;
  /** How many polls a deploy stays in "processing" once its files are uploaded. */
  let processingPolls = 1;
  let finalState = "ready";
  const tickets = new Map<string, { id: string; authorized: boolean; polls: number }>();
  /** How many polls a ticket stays unapproved; `null` never approves. */
  let approveAfter: number | null = 1;

  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  const siteJson = (site: { id: string; name: string }) => ({
    ...site,
    ssl_url: `https://${site.name}.netlify.app`,
    url: `http://${site.name}.netlify.app`,
  });
  const deployJson = (d: FakeDeploy) => {
    const site = sites.get(d.site_id);
    return {
      id: d.id,
      site_id: d.site_id,
      state: d.state,
      required: d.required,
      ssl_url: site === undefined ? null : `https://${site.name}.netlify.app`,
      deploy_ssl_url: `https://${d.id}--site.netlify.app`,
      created_at: d.created_at,
    };
  };

  /** Forms in the current deploy's HTML with `data-netlify="true"`, like Netlify's detection. */
  function formsOf(siteId: string) {
    const deploy = deploys.get(sites.get(siteId)?.current ?? "");
    if (deploy === undefined) return [];
    const forms: { id: string; name: string; paths: string[] }[] = [];
    for (const [path, digest] of Object.entries(deploy.files)) {
      const html = new TextDecoder().decode(blobs.get(digest));
      for (const match of html.matchAll(/<form[^>]*name="([^"]+)"[^>]*data-netlify="true"/g)) {
        forms.push({ id: `form-${match[1]}`, name: match[1] ?? "", paths: [path] });
      }
    }
    return forms;
  }

  const fakeFetch: typeof fetch = async (input, init) => {
    const url = new URL(String(input));
    const method = init?.method ?? "GET";
    const path = url.pathname.replace(/^\/api\/v1/, "");
    requests.push({ method, path });
    init?.signal?.throwIfAborted();

    const headers = new Headers(init?.headers);
    // Sign-in tickets are requested before there is a token.
    const signedIn = headers.get("Authorization") === `Bearer ${FAKE_TOKEN}`;
    if (!signedIn && !path.startsWith("/oauth/")) return json(401, {});
    const failure = failures.findIndex((f) => f.method === method && f.pattern.test(path));
    if (failure !== -1) {
      const [{ status, headers: extra }] = failures.splice(failure, 1) as [
        (typeof failures)[number],
      ];
      if (status === "network") throw new TypeError("fetch failed");
      return new Response(JSON.stringify({ code: status, message: "injected failure" }), {
        status,
        headers: extra,
      });
    }

    const route = (verb: string, pattern: RegExp) => {
      const match = method === verb ? path.match(pattern) : null;
      return match === null ? null : match.slice(1).map(decodeURIComponent);
    };
    let params: string[] | null = null;

    if (route("POST", /^\/oauth\/tickets$/)) {
      if (url.searchParams.get("client_id") !== FAKE_CLIENT_ID) return json(401, {});
      const ticket = { id: `ticket-${++ids}`, authorized: false, polls: 0 };
      tickets.set(ticket.id, ticket);
      return json(201, { id: ticket.id, authorized: false, client_id: FAKE_CLIENT_ID });
    }
    params = route("GET", /^\/oauth\/tickets\/([^/]+)$/);
    if (params) {
      const ticket = tickets.get(params[0] ?? "");
      if (ticket === undefined) return json(404, {});
      ticket.polls++;
      if (approveAfter !== null && ticket.polls >= approveAfter) ticket.authorized = true;
      return json(200, { id: ticket.id, authorized: ticket.authorized });
    }
    params = route("POST", /^\/oauth\/tickets\/([^/]+)\/exchange$/);
    if (params) {
      const ticket = tickets.get(params[0] ?? "");
      if (ticket?.authorized !== true) return json(401, {});
      tickets.delete(ticket.id);
      return json(201, { id: "token-1", access_token: FAKE_TOKEN, user_id: "user-1" });
    }
    if (route("GET", /^\/user$/)) return json(200, { id: "user-1" });
    if (route("GET", /^\/sites$/)) return json(200, [...sites.values()].map(siteJson));
    if (route("POST", /^\/sites$/)) {
      const body = JSON.parse(String(init?.body ?? "{}")) as { name?: string };
      const site = { id: `site-${++ids}`, name: body.name ?? `random-${ids}`, current: null };
      sites.set(site.id, site);
      return json(201, siteJson(site));
    }
    params = route("GET", /^\/sites\/([^/]+)$/);
    if (params) {
      const site = sites.get(params[0] ?? "");
      return site === undefined ? json(404, {}) : json(200, siteJson(site));
    }
    params = route("GET", /^\/sites\/([^/]+)\/deploys$/);
    if (params) {
      const siteId = params[0];
      return json(
        200,
        [...deploys.values()]
          .filter((d) => d.site_id === siteId)
          .reverse()
          .map(deployJson),
      );
    }
    params = route("POST", /^\/sites\/([^/]+)\/deploys$/);
    if (params) {
      const siteId = params[0] ?? "";
      if (!sites.has(siteId)) return json(404, {});
      const body = JSON.parse(String(init?.body)) as { files: Record<string, string> };
      const required = [...new Set(Object.values(body.files))].filter((d) => !blobs.has(d));
      const deploy: FakeDeploy = {
        id: `deploy-${++ids}`,
        site_id: siteId,
        files: body.files,
        required,
        state: required.length > 0 ? "uploading" : "processing",
        created_at: new Date(ids * 1000).toISOString(),
      };
      deploys.set(deploy.id, deploy);
      return json(200, deployJson(deploy));
    }
    params = route("POST", /^\/sites\/([^/]+)\/deploys\/([^/]+)\/restore$/);
    if (params) {
      const site = sites.get(params[0] ?? "");
      const deploy = deploys.get(params[1] ?? "");
      if (site === undefined || deploy?.state !== "ready") return json(404, {});
      site.current = deploy.id;
      return json(200, { ...deployJson(deploy), state: "current" });
    }
    params = route("GET", /^\/sites\/([^/]+)\/forms$/);
    if (params) return json(200, formsOf(params[0] ?? ""));
    params = route("GET", /^\/deploys\/([^/]+)$/);
    if (params) {
      const deploy = deploys.get(params[0] ?? "");
      if (deploy === undefined) return json(404, {});
      if (deploy.state === "processing") {
        if (processingPolls > 0) processingPolls--;
        else {
          deploy.state = finalState;
          const site = sites.get(deploy.site_id);
          if (site !== undefined && finalState === "ready") site.current = deploy.id;
        }
      }
      return json(200, deployJson(deploy));
    }
    // The file path keeps its encoding here; it is decoded segment by segment below.
    const upload = method === "PUT" ? path.match(/^\/deploys\/([^/]+)\/files\/(.+)$/) : null;
    if (upload) {
      const deploy = deploys.get(decodeURIComponent(upload[1] ?? ""));
      if (deploy === undefined) return json(404, {});
      const filePath = `/${(upload[2] ?? "").split("/").map(decodeURIComponent).join("/")}`;
      const data = init?.body as Uint8Array;
      const digest = sha1(data);
      if (deploy.files[filePath] !== digest) return json(422, { message: "digest mismatch" });
      blobs.set(digest, data);
      deploy.required = deploy.required.filter((d) => d !== digest);
      if (deploy.required.length === 0) deploy.state = "processing";
      return json(200, { id: digest, path: filePath });
    }
    return json(404, {});
  };

  return {
    fetch: fakeFetch,
    requests,
    /** Uploads (PUT) made so far, by site path. */
    uploads: () =>
      requests
        .filter((r) => r.method === "PUT")
        .map((r) => r.path.replace(/^\/deploys\/[^/]+\/files\//, "")),
    /** The live content of `path` on `siteId`. */
    live(siteId: string, path: string): string | undefined {
      const deploy = deploys.get(sites.get(siteId)?.current ?? "");
      const digest = deploy?.files[`/${path}`];
      return digest === undefined ? undefined : new TextDecoder().decode(blobs.get(digest));
    },
    /** Makes the next `times` matching requests fail with `status` (or a network error). */
    failNext(
      method: string,
      pattern: RegExp,
      status: number | "network",
      { times = 1, headers = {} }: { times?: number; headers?: Record<string, string> } = {},
    ) {
      for (let i = 0; i < times; i++) failures.push({ method, pattern, status, headers });
    },
    /** Sign-in tickets are approved on the `polls`-th check, or never (`null`). */
    approveTickets(polls: number | null) {
      approveAfter = polls;
    },
    /** Deploys stay "processing" for `polls` polls, then end in `state`. */
    processing(polls: number, state = "ready") {
      processingPolls = polls;
      finalState = state;
    },
  };
}
