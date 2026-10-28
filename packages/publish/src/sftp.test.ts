import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { BuildOutput, PublishEvent } from "./publisher.js";
import { MANIFEST_FILE } from "./remote-folder.js";
import { readSftpHostKey, type SftpDestination, sftpPublisher } from "./sftp.js";
import { hostKeys, startSftpServer } from "./sftp-server.test-helper.js";

const bytes = (text: string) => new TextEncoder().encode(text);
const build = (files: Record<string, string>): BuildOutput => ({
  files: new Map(Object.entries(files).map(([path, content]) => [path, bytes(content)])),
});

let server: Awaited<ReturnType<typeof startSftpServer>>;
beforeAll(async () => {
  server = await startSftpServer({ user: "baker", password: "test-only-password" });
});
afterAll(async () => {
  await server?.stop();
});

const destination = (): SftpDestination => ({
  host: "127.0.0.1",
  port: server.port,
  user: "baker",
  folder: "/site",
  hostKey: server.hostKey,
  url: "https://bakery.example/",
});
const options = { password: "test-only-password", timeoutMs: 10_000 };

async function publish(files: Record<string, string>, dest = destination()) {
  const events: PublishEvent[] = [];
  for await (const event of sftpPublisher(options).publish(
    build(files),
    dest,
    AbortSignal.timeout(30_000),
  )) {
    events.push(event);
  }
  return events;
}

/** Runs a publish to its end, giving the error it stopped with. */
async function failure(publishing: AsyncIterable<PublishEvent>) {
  try {
    for await (const _event of publishing) {
      // To the end.
    }
  } catch (error) {
    return error;
  }
  return undefined;
}

const onHost = (path: string) => readFileSync(join(server.site, path), "utf8");

const site = {
  "index.html": "<p>Home</p>",
  "about.html": "<p>About</p>",
  "assets/css/site.css": "body {}",
};

// Each test talks to a real SSH server over the network stack, several publishes in some: more
// than a unit test's time, on a loaded CI runner especially.
describe("sftpPublisher (0.3)", { timeout: 30_000 }, () => {
  it("publishes, then sends only what changed and removes what the site dropped", async () => {
    const first = await publish(site);
    expect(first.at(-1)).toMatchObject({ type: "published", uploaded: 3, removed: 0 });
    expect(onHost("assets/css/site.css")).toBe("body {}");
    expect(JSON.parse(onHost(MANIFEST_FILE)).files).toHaveProperty("index.html");

    const { "about.html": _dropped, ...rest } = site;
    const second = await publish({ ...rest, "index.html": "<p>Home, v2</p>" });

    expect(second.at(-1)).toEqual({
      type: "published",
      url: "https://bakery.example/",
      uploaded: 1,
      unchanged: 1,
      removed: 1,
    });
    // Replaced, on a server whose rename won't overwrite.
    expect(onHost("index.html")).toBe("<p>Home, v2</p>");
    expect(existsSync(join(server.site, "about.html"))).toBe(false);
    expect(readdirSync(server.site).filter((name) => name.endsWith(".webforge-upload"))).toEqual(
      [],
    );
  });

  it("leaves files Webforge didn't put there alone", async () => {
    writeFileSync(join(server.site, "their-notes.txt"), "keep me");

    await publish({ "index.html": "<p>Home, v3</p>" });

    expect(onHost("their-notes.txt")).toBe("keep me");
  });

  it("keeps the live site whole when cancelled mid-publish", async () => {
    await publish(site);
    const controller = new AbortController();
    const changed = Object.fromEntries(
      Object.entries(site).map(([path, text]) => [path, `${text} v9`]),
    );

    const error = await failure(
      (async function* () {
        for await (const event of sftpPublisher(options).publish(
          build(changed),
          destination(),
          controller.signal,
        )) {
          if (event.type === "uploading") controller.abort();
          yield event;
        }
      })(),
    );

    expect(error).toMatchObject({ name: "PublishError", code: "cancelled" });
    expect(onHost("index.html")).toBe("<p>Home</p>");
    expect(onHost("about.html")).toBe("<p>About</p>");
  });

  it("shows the host key to trust, without signing in", async () => {
    await expect(readSftpHostKey("127.0.0.1", server.port)).resolves.toBe(server.hostKey);
  });

  it("refuses a host whose key isn't the trusted one, before the password is sent", async () => {
    const impostor = {
      ...destination(),
      hostKey: "SHA256:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    };

    expect(await sftpPublisher(options).test(impostor)).toEqual({
      ok: false,
      code: "untrusted-host",
    });
    expect(
      await failure(
        sftpPublisher(options).publish(build(site), impostor, AbortSignal.timeout(30_000)),
      ),
    ).toMatchObject({
      code: "untrusted-host",
    });
  });

  it("tells a wrong password, a missing folder and an unreachable host apart", async () => {
    expect(await sftpPublisher(options).test(destination())).toEqual({ ok: true });
    expect(await sftpPublisher({ ...options, password: "wrong" }).test(destination())).toEqual({
      ok: false,
      code: "unauthorized",
    });
    expect(await sftpPublisher(options).test({ ...destination(), folder: "/nowhere" })).toEqual({
      ok: false,
      code: "not-found",
    });
    expect(await sftpPublisher(options).test({ ...destination(), port: 1 })).toEqual({
      ok: false,
      code: "network",
    });
  });

  it("never puts the password in an error", async () => {
    const error = await failure(
      sftpPublisher({ ...options, password: "wrong-secret" }).publish(
        build(site),
        destination(),
        AbortSignal.timeout(30_000),
      ),
    );

    expect(error).toMatchObject({ code: "unauthorized" });
    expect(String((error as Error).message)).not.toContain("wrong-secret");
  });
});

describe("the test server's host key (#588)", () => {
  it("makes another when ssh2 can't read the one it made", () => {
    const good = hostKeys();
    let calls = 0;
    const keys = hostKeys(() => {
      calls += 1;
      // The first unreadable, as ssh2's generator now and then makes one.
      return calls === 1 ? { ...good, public: "ssh-ed25519 AAAA" } : good;
    });

    expect(keys.private).toBe(good.private);
    expect(calls).toBe(2);
  });
});
