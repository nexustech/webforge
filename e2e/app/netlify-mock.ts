import { createServer, type IncomingMessage } from "node:http";
import type { AddressInfo } from "node:net";
import { FAKE_CLIENT_ID, FAKE_TOKEN, fakeNetlify } from "@webforge/test-utils/netlify";

// A mock of Netlify's API on this computer (4.2, #70), for the app to publish to as it would to
// Netlify: the same in-memory service `@webforge/publish`'s tests use, answering HTTP. The app
// reaches it when launched with `WEBFORGE_E2E_NETLIFY_API` set to its `apiBase`, which only an
// unpackaged app honours. It answers sign-in tickets, sites, the digest deploy, file uploads,
// deploy polling, deploys and their restore, and forms; and it serves each site at its own address
// below `/served/`, as Netlify serves it to visitors, or sends them to Netlify's login when the
// test protects it. 4.4b's UI tests can use it too.

/** A Netlify deploy as the mock lists it. */
type MockDeploy = {
  readonly id: string;
  readonly site_id: string;
  readonly state: string;
  readonly created_at: string;
};

/** A form Netlify found in a site's live deploy. */
type MockForm = { readonly name: string; readonly paths: readonly string[] };

/** The mock, running: where it answers, and what was sent to it. */
export type MockNetlify = {
  /** Its API's address, `http://127.0.0.1:<port>/api/v1`: the app's `WEBFORGE_E2E_NETLIFY_API`. */
  readonly apiBase: string;
  /** The only token it accepts, and the client ID its sign-in tickets need. */
  readonly token: string;
  readonly clientId: string;
  /** A new Netlify site, as the person's account would have, finding its forms: its id. */
  addSite(name: string): Promise<string>;
  /** Sends the site's visitors to Netlify's login, as site protection does. */
  protect(siteId: string): void;
  /** The address the site is served at, as Netlify's record of it gives. */
  addressOf(name: string): string;
  /** The site paths uploaded so far, in order: only what Netlify didn't have. */
  uploads(): readonly string[];
  /** The site's deploys, newest first, and the one it serves. */
  deploys(siteId: string): Promise<readonly MockDeploy[]>;
  live(siteId: string): Promise<string | undefined>;
  /** The live content of `path` (`index.html`), as a visitor would get it. */
  file(siteId: string, path: string): string | undefined;
  /** The forms Netlify finds in the site's live deploy. */
  forms(siteId: string): Promise<readonly MockForm[]>;
  /** Forgets deploy `id`, as Netlify does once a deploy is older than the account keeps. */
  dropDeploy(id: string): void;
  /** Every request so far: method and path below `/api/v1`. */
  readonly requests: readonly { readonly method: string; readonly path: string }[];
  close(): Promise<void>;
};

/** The whole body of `request`. */
async function bodyOf(request: IncomingMessage): Promise<Uint8Array<ArrayBuffer>> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(chunk as Buffer);
  return new Uint8Array(Buffer.concat(chunks));
}

/** Starts the mock on a free port of 127.0.0.1. */
export async function startMockNetlify(): Promise<MockNetlify> {
  let origin = "";
  const served = (name: string) => `${origin}/served/${encodeURIComponent(name)}/`;
  const fake = fakeNetlify({ addressOf: served });
  const protectedSites = new Set<string>();
  const server = createServer((request, response) => {
    void (async () => {
      // A visitor to a site: its home page, or Netlify's login for a protected one.
      const visit = /^\/served\/([^/]+)\//.exec(request.url ?? "");
      if (visit !== null) {
        const siteId = fake.siteNamed(decodeURIComponent(visit[1] ?? ""));
        if (siteId !== undefined && protectedSites.has(siteId)) {
          response.writeHead(302, {
            Location: `https://app.netlify.com/edge-access/${visit[1]}?redirect=%2F`,
          });
          response.end();
          return;
        }
        const page = siteId === undefined ? undefined : fake.live(siteId, "index.html");
        response.writeHead(page === undefined ? 404 : 200, { "Content-Type": "text/html" });
        response.end(page ?? "");
        return;
      }
      const bytes = await bodyOf(request);
      const headers = new Headers();
      for (const [name, value] of Object.entries(request.headers)) {
        if (typeof value === "string") headers.set(name, value);
      }
      // A file upload is bytes; anything else Netlify is sent is JSON.
      const body =
        bytes.length === 0
          ? undefined
          : request.method === "PUT"
            ? bytes
            : new TextDecoder().decode(bytes);
      const answer = await fake.fetch(`http://127.0.0.1${request.url ?? "/"}`, {
        method: request.method ?? "GET",
        headers,
        ...(body === undefined ? {} : { body }),
      });
      response.writeHead(answer.status, Object.fromEntries(answer.headers));
      response.end(Buffer.from(await answer.arrayBuffer()));
    })().catch(() => {
      response.writeHead(500);
      response.end();
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  origin = `http://127.0.0.1:${port}`;
  const apiBase = `${origin}/api/v1`;

  /** A signed-in request to the fake itself, for what a test looks at. */
  const ask = async <T>(method: string, path: string, body?: unknown): Promise<T> => {
    const answer = await fake.fetch(`${apiBase}${path}`, {
      method,
      headers: { Authorization: `Bearer ${FAKE_TOKEN}`, "Content-Type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return (await answer.json()) as T;
  };
  // What the test asks isn't what the app sent.
  const sent = () => fake.requests.length;
  const forget = (from: number) => {
    fake.requests.splice(from);
  };

  return {
    apiBase,
    token: FAKE_TOKEN,
    clientId: FAKE_CLIENT_ID,
    async addSite(name) {
      const from = sent();
      // Finding forms, as the sites Webforge creates do (part 2).
      const site = await ask<{ id: string }>("POST", "/sites", {
        name,
        processing_settings: { ignore_html_forms: false },
      });
      forget(from);
      return site.id;
    },
    protect: (siteId) => {
      protectedSites.add(siteId);
    },
    addressOf: served,
    uploads: () => fake.uploads(),
    async deploys(siteId) {
      const from = sent();
      const list = await ask<MockDeploy[]>("GET", `/sites/${encodeURIComponent(siteId)}/deploys`);
      forget(from);
      return list;
    },
    async live(siteId) {
      const from = sent();
      const site = await ask<{ published_deploy: { id: string } | null }>(
        "GET",
        `/sites/${encodeURIComponent(siteId)}`,
      );
      forget(from);
      return site.published_deploy?.id;
    },
    file: (siteId, path) => fake.live(siteId, path),
    async forms(siteId) {
      const from = sent();
      const list = await ask<{ name: string; paths: string[] }[]>(
        "GET",
        `/sites/${encodeURIComponent(siteId)}/forms`,
      );
      forget(from);
      return list.map(({ name, paths }) => ({ name, paths }));
    },
    dropDeploy: (id) => fake.dropDeploy(id),
    requests: fake.requests,
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
}
