import { createServer, type IncomingMessage } from "node:http";
import type { AddressInfo } from "node:net";
import { FAKE_CLIENT_ID, FAKE_TOKEN, fakeNetlify } from "@webforge/test-utils/netlify";

// A mock of Netlify's API on this computer (4.2, #70), for the app to publish to as it would to
// Netlify: the same in-memory service `@webforge/publish`'s tests use, answering HTTP. The app
// reaches it when launched with `WEBFORGE_E2E_NETLIFY_API` set to its `apiBase`, which only an
// unpackaged app honours. It answers sign-in tickets, sites, the digest deploy, file uploads,
// deploy polling, deploys and their restore, and forms. 4.4b's UI tests can use it too.

/** A Netlify deploy as the mock lists it. */
export type MockDeploy = {
  readonly id: string;
  readonly site_id: string;
  readonly state: string;
  readonly created_at: string;
};

/** A form Netlify found in a site's live deploy. */
export type MockForm = { readonly name: string; readonly paths: readonly string[] };

/** The mock, running: where it answers, and what was sent to it. */
export type MockNetlify = {
  /** Its API's address, `http://127.0.0.1:<port>/api/v1`: the app's `WEBFORGE_E2E_NETLIFY_API`. */
  readonly apiBase: string;
  /** The only token it accepts, and the client ID its sign-in tickets need. */
  readonly token: string;
  readonly clientId: string;
  /** A new Netlify site, as the person's account would have: its id. */
  addSite(name: string): Promise<string>;
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
  const fake = fakeNetlify();
  const server = createServer((request, response) => {
    void (async () => {
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
  const apiBase = `http://127.0.0.1:${port}/api/v1`;

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
      const site = await ask<{ id: string }>("POST", "/sites", { name });
      forget(from);
      return site.id;
    },
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
