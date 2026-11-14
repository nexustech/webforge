import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type FtpDestination, ftpPublisher } from "./ftp.js";
import { startFtpServer, TEST_TLS } from "./ftp-server.test-helper.js";
import type { BuildOutput, PublishEvent } from "./publisher.js";
import { describePublisherContract } from "./publisher-contract.test-helper.js";

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
  site: { projectId: "rosas-bakery", destinationId: "live" },
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

const _site = {
  "index.html": "<p>Home</p>",
  "about.html": "<p>About</p>",
  "assets/css/site.css": "body {}",
};

describePublisherContract<FtpDestination>("ftpPublisher, over FTPS where it can", () => ({
  publisher: (password) => ftpPublisher({ ...trusted, password }),
  destination: () => destination(secure),
  siteFolder: () => server.site,
  password: "test-only-password",
}));

// Each test talks to a real FTP server over the network stack, several publishes in some: more
// than a unit test's time, on a loaded CI runner especially.
describe("ftpPublisher (0.3)", { timeout: 30_000 }, () => {
  it("publishes over plain FTP too", async () => {
    const events = await publish({ "index.html": "<p>Plain</p>" }, "ftp");

    expect(events.at(-1)).toMatchObject({ type: "published", uploaded: 1 });
    expect(onHost("index.html")).toBe("<p>Plain</p>");
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

describe("an FTPS host too busy to answer (4.3)", { timeout: 30_000 }, () => {
  let busy: Awaited<ReturnType<typeof startFtpServer>>;
  beforeAll(async () => {
    busy = await startFtpServer({
      user: "baker",
      password: "test-only-password",
      busy: "421 Too many connections",
    });
  });
  afterAll(async () => {
    await busy?.stop();
  });

  it("says it couldn't be reached, not that it has no FTPS", async () => {
    const dest = { ...destination("ftps"), port: busy.port };

    expect(await ftpPublisher(trusted).test(dest)).toEqual({ ok: false, code: "network" });
  });
});
