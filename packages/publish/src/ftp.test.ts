import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type FtpDestination, ftpPublisher } from "./ftp.js";
import { startFtpServer, TEST_TLS } from "./ftp-server.test-helper.js";
import type { BuildOutput, PublishEvent } from "./publisher.js";
import { MANIFEST_FILE } from "./remote-folder.js";

const bytes = (text: string) => new TextEncoder().encode(text);
const build = (files: Record<string, string>): BuildOutput => ({
  files: new Map(Object.entries(files).map(([path, content]) => [path, bytes(content)])),
});

let server: Awaited<ReturnType<typeof startFtpServer>>;
beforeAll(async () => {
  server = await startFtpServer({ user: "baker", password: "test-only-password" });
});
afterAll(async () => {
  await server?.stop();
});

/** FTPS where openssl could make the test certificate, plain FTP where it couldn't. */
const secure: FtpDestination["protocol"] = TEST_TLS === undefined ? "ftp" : "ftps";

const destination = (protocol: FtpDestination["protocol"]): FtpDestination => ({
  protocol,
  host: "127.0.0.1",
  port: server.port,
  user: "baker",
  folder: "/site",
  url: "https://bakery.example/",
});
/** FTPS trusting the test certificate, as a host's real certificate is trusted. */
const trusted = {
  password: "test-only-password",
  tls: { ca: TEST_TLS?.cert ?? "" },
  timeoutMs: 10_000,
};

async function publish(files: Record<string, string>, protocol = secure) {
  const events: PublishEvent[] = [];
  for await (const event of ftpPublisher(trusted).publish(
    build(files),
    destination(protocol),
    AbortSignal.timeout(30_000),
  )) {
    events.push(event);
  }
  return events;
}

const onHost = (path: string) => readFileSync(join(server.site, path), "utf8");

const site = {
  "index.html": "<p>Home</p>",
  "about.html": "<p>About</p>",
  "assets/css/site.css": "body {}",
};

// Each test talks to a real FTP server over the network stack, several publishes in some: more
// than a unit test's time, on a loaded CI runner especially.
describe("ftpPublisher (0.3)", { timeout: 30_000 }, () => {
  it("publishes, then sends only what changed and removes what the site dropped", async () => {
    const first = await publish(site);
    expect(first.at(-1)).toMatchObject({ type: "published", uploaded: 3, removed: 0 });
    expect(onHost("assets/css/site.css")).toBe("body {}");
    expect(JSON.parse(onHost(MANIFEST_FILE)).files).toHaveProperty("index.html");

    const { "about.html": _dropped, ...rest } = site;
    const second = await publish({ ...rest, "index.html": "<p>Home, v2</p>" });

    expect(second.filter((event) => event.type === "uploading")).toEqual([
      { type: "uploading", path: "index.html", done: 0, total: 1 },
    ]);
    expect(second.at(-1)).toEqual({
      type: "published",
      url: "https://bakery.example/",
      uploaded: 1,
      unchanged: 1,
      removed: 1,
    });
    expect(onHost("index.html")).toBe("<p>Home, v2</p>");
    expect(existsSync(join(server.site, "about.html"))).toBe(false);
    // No upload file is left beside the files it replaced.
    expect(readdirSync(server.site).filter((name) => name.endsWith(".webforge-upload"))).toEqual(
      [],
    );
  });

  it("leaves files Webforge didn't put there alone", async () => {
    writeFileSync(join(server.site, "their-notes.txt"), "keep me");

    await publish({ "index.html": "<p>Home, v3</p>" });

    expect(onHost("their-notes.txt")).toBe("keep me");
  });

  it("publishes over plain FTP too", async () => {
    const events = await publish({ "index.html": "<p>Plain</p>" }, "ftp");

    expect(events.at(-1)).toMatchObject({ type: "published", uploaded: 1 });
    expect(onHost("index.html")).toBe("<p>Plain</p>");
  });

  it("keeps the live site whole when cancelled mid-publish", async () => {
    await publish(site);
    const controller = new AbortController();
    const changed = Object.fromEntries(
      Object.entries(site).map(([path, text]) => [path, `${text} v9`]),
    );
    const publishing = ftpPublisher(trusted).publish(
      build(changed),
      destination(secure),
      controller.signal,
    );

    let caught: unknown;
    try {
      for await (const event of publishing) {
        // Cancel as the first file starts, so it is cut off mid-transfer or before it.
        if (event.type === "uploading") controller.abort();
      }
    } catch (error) {
      caught = error;
    }

    expect(caught).toMatchObject({ name: "PublishError", code: "cancelled" });
    // The pages are the published ones: the home page goes last and was never reached.
    expect(onHost("index.html")).toBe("<p>Home</p>");
    expect(onHost("about.html")).toBe("<p>About</p>");
  });

  it("tells a wrong password, a missing folder and an unreachable host apart", async () => {
    const dest = destination(secure);

    expect(await ftpPublisher(trusted).test(dest)).toEqual({ ok: true });
    expect(await ftpPublisher({ ...trusted, password: "wrong" }).test(dest)).toEqual({
      ok: false,
      code: "unauthorized",
    });
    expect(await ftpPublisher(trusted).test({ ...dest, folder: "/nowhere" })).toEqual({
      ok: false,
      code: "not-found",
    });
    expect(await ftpPublisher(trusted).test({ ...dest, port: 1 })).toEqual({
      ok: false,
      code: "network",
    });
  });

  it.skipIf(TEST_TLS === undefined)(
    "refuses an FTPS certificate the computer doesn't trust, before signing in",
    async () => {
      const untrusted = ftpPublisher({ password: "test-only-password", timeoutMs: 10_000 });

      expect(await untrusted.test(destination(secure))).toEqual({
        ok: false,
        code: "untrusted-host",
      });
    },
  );

  it("never puts the password in an error", async () => {
    let caught: unknown;
    try {
      for await (const _event of ftpPublisher({ ...trusted, password: "wrong-secret" }).publish(
        build(site),
        destination(secure),
        AbortSignal.timeout(30_000),
      )) {
        // Signing in fails before any file.
      }
    } catch (error) {
      caught = error;
    }

    expect(caught).toMatchObject({ code: "unauthorized" });
    expect(String((caught as Error).message)).not.toContain("wrong-secret");
  });
});

describe("an FTPS destination on a host without FTPS (4.3)", { timeout: 30_000 }, () => {
  let plain: Awaited<ReturnType<typeof startFtpServer>>;
  beforeAll(async () => {
    plain = await startFtpServer({ user: "baker", password: "test-only-password", tls: false });
  });
  afterAll(async () => {
    await plain?.stop();
  });

  it("says the host doesn't offer encryption, before the password is sent, so plain FTP can be offered", async () => {
    const dest = { ...destination("ftps"), port: plain.port };

    expect(await ftpPublisher(trusted).test(dest)).toEqual({ ok: false, code: "no-encryption" });
    // A wrong password gives the same answer: the host never saw it.
    expect(await ftpPublisher({ ...trusted, password: "wrong" }).test(dest)).toEqual({
      ok: false,
      code: "no-encryption",
    });
    expect(await ftpPublisher(trusted).test({ ...dest, protocol: "ftp" })).toEqual({ ok: true });
  });
});
