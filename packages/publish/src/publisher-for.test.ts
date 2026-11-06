import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { PublishDestination } from "@webforge/model";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { publisherFor } from "./publisher-for.js";
import { MANIFEST_FILE } from "./remote-folder.js";
import type { PublishRunEvent } from "./run.js";
import { startSftpServer } from "./sftp-server.test-helper.js";

const bytes = (text: string) => new TextEncoder().encode(text);
const build = { files: new Map([["index.html", bytes("<p>Home</p>")]]) };
const target = { site: { projectId: "rosas-bakery", destinationId: "live" } };

let server: Awaited<ReturnType<typeof startSftpServer>>;
beforeAll(async () => {
  server = await startSftpServer({ user: "baker", password: "test-only-password" });
});
afterAll(async () => {
  await server?.stop();
});

const sftp = (): PublishDestination => ({
  id: "6f1c1b6e-8a3e-4c1e-9d55-2f5c1e0a7b10",
  name: "My host",
  kind: "file-transfer",
  settings: {
    protocol: "sftp",
    host: "127.0.0.1",
    port: server.port,
    user: "baker",
    folder: "/site",
    signIn: "password",
  },
});
const ftps: PublishDestination = {
  id: "0b9a8f6e-3c2d-4e1f-8a7b-6c5d4e3f2a10",
  name: "Old host",
  kind: "file-transfer",
  settings: { protocol: "ftps", host: "127.0.0.1", port: 1, user: "baker", folder: "/" },
};
const netlify: PublishDestination = {
  id: "4f9a2c1e-7b3d-4a5e-9c8f-1d2e3f4a5b6c",
  name: "Netlify",
  kind: "netlify",
};
const password = { password: "test-only-password" };
const timeout = { timeoutMs: 10_000 };

/** The events of a publish to its end, or the error it stopped with. */
async function run(publishing: AsyncIterable<PublishRunEvent>) {
  const events: PublishRunEvent[] = [];
  try {
    for await (const event of publishing) events.push(event);
  } catch (error) {
    return error;
  }
  return events;
}

describe("publisherFor (4.4a, ADR 0018 §2)", { timeout: 30_000 }, () => {
  it("tests and publishes an SFTP destination with its sign-in and trusted host key", async () => {
    const publisher = publisherFor(sftp(), password, { hostKey: server.hostKey }, timeout);

    expect(await publisher.test()).toEqual({ ok: true });
    const events = await run(publisher.publish(build, target, AbortSignal.timeout(20_000)));
    expect(events).toContainEqual(expect.objectContaining({ type: "published" }));
    expect(readFileSync(join(server.site, "index.html"), "utf8")).toBe("<p>Home</p>");
    // The remote manifest names the project and the destination it was published as (A8).
    const manifest = JSON.parse(readFileSync(join(server.site, MANIFEST_FILE), "utf8"));
    expect(manifest).toMatchObject({ site: target.site });
  });

  it("refuses before connecting: no trusted key, or a sign-in of the wrong kind", async () => {
    const refusals = [
      [publisherFor(sftp(), password, {}), "untrusted-host"],
      [publisherFor(sftp(), { token: "nfp_x" }, { hostKey: server.hostKey }), "unauthorized"],
      [publisherFor(ftps, { privateKey: "key" }, {}), "unauthorized"],
      [publisherFor(netlify, password, {}), "unauthorized"],
      [publisherFor(netlify, { token: "nfp_x" }, {}), "not-found"],
    ] as const;
    for (const [publisher, code] of refusals) {
      expect(await publisher.test()).toEqual({ ok: false, code });
      const error = await run(publisher.publish(build, target, AbortSignal.timeout(5_000)));
      expect(error).toMatchObject({ code });
    }
  });

  it("connects an FTPS destination to its own host and port", async () => {
    // Nothing listens on port 1: the publisher reached for this destination's address.
    const result = await publisherFor(ftps, password, {}, { timeoutMs: 2_000 }).test();
    expect(result).toEqual({ ok: false, code: "network" });
  });
});
