import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { FAKE_TOKEN, fakeNetlify } from "./fake-netlify.test-helper.js";
import { ftpPublisher } from "./ftp.js";
import { startFtpServer, TEST_TLS } from "./ftp-server.test-helper.js";
import { netlifyClient, netlifyPublisher } from "./netlify.js";
import type { BuildOutput, Publisher } from "./publisher.js";
import { type PublishRunEvent, publishSite } from "./run.js";
import { sftpPublisher } from "./sftp.js";
import { startSftpServer } from "./sftp-server.test-helper.js";
import { verifyPublished } from "./verify.js";

// Every publisher through the publish run (4.1), on the tests' own servers: a publish is checked
// at the live address, and a publish cancelled part-way leaves the previous site usable, its home
// page pointing only at files that are there. The live address is answered from what each server
// holds, as a web server in front of it would.

const bytes = (text: string) => new TextEncoder().encode(text);
const build = (files: Record<string, string>): BuildOutput => ({
  files: new Map(Object.entries(files).map(([path, text]) => [path, bytes(text)])),
});

/** A site whose pages point at a stylesheet named for its version, as the pipeline's hashes do. */
const version = (n: number) =>
  build({
    "index.html": `<link href="assets/css/site.${n}.css"><h1>Rosa's Bakery ${n}</h1>`,
    "about.html": `<link href="assets/css/site.${n}.css"><h1>About ${n}</h1>`,
    [`assets/css/site.${n}.css`]: `body { --v: ${n} }`,
    "assets/img/logo.webp": "logo",
  });

/** A destination as the run sees it: its publisher, settings, and what it serves at its address. */
type Harness = {
  readonly publisher: Publisher<unknown>;
  readonly dest: unknown;
  readonly live: (path: string) => string | undefined;
  /** Whether the run asks the address (FTP, SFTP); Netlify checks through its API instead. */
  readonly asksAddress: boolean;
};

/** A web server's answer at `url` for a host serving `live`: the home page for `/`. */
const served =
  (live: (path: string) => string | undefined): typeof fetch =>
  async (input) => {
    const path = new URL(String(input)).pathname.replace(/^\//, "") || "index.html";
    const text = live(path.endsWith("/") ? `${path}index.html` : path);
    return text === undefined ? new Response("", { status: 404 }) : new Response(text);
  };

async function run(harness: Harness, site: BuildOutput, signal: AbortSignal) {
  const events: PublishRunEvent[] = [];
  const verify = (url: string, built: BuildOutput, cancel: AbortSignal) =>
    verifyPublished(url, built, { fetch: served(harness.live), delayMs: 0, signal: cancel });
  for await (const event of publishSite(
    harness.publisher,
    site,
    harness.dest,
    signal,
    harness.asksAddress ? { verify } : {},
  )) {
    events.push(event);
  }
  return events;
}

let ftp: Awaited<ReturnType<typeof startFtpServer>>;
let sftp: Awaited<ReturnType<typeof startSftpServer>>;
beforeAll(async () => {
  [ftp, sftp] = await Promise.all([
    startFtpServer({ user: "baker", password: "test-only-password" }),
    startSftpServer({ user: "baker", password: "test-only-password" }),
  ]);
});
afterAll(async () => {
  await Promise.all([ftp?.stop(), sftp?.stop()]);
});

const onDisk = (folder: string) => (path: string) => {
  const file = join(folder, path);
  return existsSync(file) ? readFileSync(file, "utf8") : undefined;
};

const harnesses: Record<string, () => Promise<Harness>> = {
  netlify: async () => {
    const netlify = fakeNetlify();
    const options = { token: FAKE_TOKEN, fetch: netlify.fetch, pollIntervalMs: 1, retryBaseMs: 1 };
    const { id: siteId } = await netlifyClient(options).createSite("rosas-bakery");
    return {
      publisher: netlifyPublisher(options) as Publisher<unknown>,
      dest: { siteId },
      live: (path) => netlify.live(siteId, path),
      asksAddress: false,
    };
  },
  [TEST_TLS === undefined ? "ftp" : "ftps"]: async () => ({
    publisher: ftpPublisher({
      password: "test-only-password",
      tls: { ca: TEST_TLS?.cert ?? "" },
      timeoutMs: 10_000,
    }) as Publisher<unknown>,
    dest: {
      protocol: TEST_TLS === undefined ? "ftp" : "ftps",
      host: "127.0.0.1",
      port: ftp.port,
      user: "baker",
      folder: "/site",
      url: "https://bakery.example/",
    },
    live: onDisk(ftp.site),
    asksAddress: true,
  }),
  sftp: async () => ({
    publisher: sftpPublisher({
      password: "test-only-password",
      timeoutMs: 10_000,
    }) as Publisher<unknown>,
    dest: {
      host: "127.0.0.1",
      port: sftp.port,
      user: "baker",
      folder: "/site",
      hostKey: sftp.hostKey,
      url: "https://bakery.example/",
    },
    live: onDisk(sftp.site),
    asksAddress: true,
  }),
};

// Real servers over the network stack, several publishes per test.
describe.each(Object.entries(harnesses))("publishSite with %s (4.1)", (_name, harness) => {
  it("publishes, then finds the new home page at the live address", {
    timeout: 30_000,
  }, async () => {
    const destination = await harness();

    const events = await run(destination, version(1), AbortSignal.timeout(20_000));

    const types = events.map((event) => event.type);
    expect(types.slice(-3)).toEqual(["published", "verifying", "verified"]);
    expect(events.at(-1)).toMatchObject({ type: "verified", result: { status: "live" } });
  });

  it("keeps the previous site usable when cancelled part-way, and checks nothing", {
    timeout: 30_000,
  }, async () => {
    const destination = await harness();
    await run(destination, version(1), AbortSignal.timeout(20_000));
    const controller = new AbortController();

    let caught: unknown;
    const events: PublishRunEvent[] = [];
    try {
      for await (const event of publishSite(
        destination.publisher,
        version(2),
        destination.dest,
        controller.signal,
      )) {
        events.push(event);
        // Cancel once the first file starts: the new stylesheet may arrive, the pages don't.
        if (event.type === "uploading") controller.abort();
      }
    } catch (error) {
      caught = error;
    }

    expect(caught).toMatchObject({ name: "PublishError", code: "cancelled" });
    expect(events.map((event) => event.type)).not.toContain("verifying");
    const home = destination.live("index.html") ?? "";
    expect(home).toContain("Rosa's Bakery 1");
    const stylesheet = /href="([^"]+)"/.exec(home)?.[1] ?? "";
    expect(destination.live(stylesheet)).toBe("body { --v: 1 }");
  });
});

describe("publishSite's check", () => {
  it("is skipped once cancelled, the publish itself done", async () => {
    const controller = new AbortController();
    const publisher: Publisher<null> = {
      test: async () => ({ ok: true }),
      async *publish() {
        yield {
          type: "published",
          url: "https://rosas.example",
          uploaded: 1,
          unchanged: 0,
          removed: 0,
        };
      },
    };
    let checked = false;

    const events: PublishRunEvent[] = [];
    for await (const event of publishSite(publisher, version(1), null, controller.signal, {
      verify: async () => {
        checked = true;
        return { status: "live" };
      },
    })) {
      events.push(event);
      if (event.type === "verifying") controller.abort();
    }

    expect(checked).toBe(false);
    expect(events.at(-1)).toEqual({
      type: "verified",
      url: "https://rosas.example",
      result: { status: "unchecked" },
    });
  });
});
