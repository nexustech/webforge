import { generateKeyPairSync } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { IpcMain, IpcMainInvokeEvent } from "electron";
import { afterAll, describe, expect, it } from "vitest";
import {
  createKeyFiles,
  type KeyFiles,
  readHostKey,
  readKeyFile,
  registerPublishHandlers,
  testConnection,
} from "./publish-ipc.js";

type Handler = (event: IpcMainInvokeEvent, ...args: unknown[]) => Promise<unknown>;

/**
 * The handler of `channel`, called as from a renderer that `trusted` says it trusts or not, with
 * the chosen keys held in `keys`.
 */
function invoker(
  channel: string,
  chooseKeyFile = async () => undefined as string | undefined,
  trusted = true,
  keys: KeyFiles = createKeyFiles(),
) {
  const registered = new Map<string, Handler>();
  const ipc = {
    handle: (name: string, handler: Handler) => registered.set(name, handler),
  } as unknown as Pick<IpcMain, "handle">;
  registerPublishHandlers(ipc, () => trusted, { chooseKeyFile, timeoutMs: 2_000 }, keys);
  return (...args: unknown[]) =>
    registered.get(channel)?.({ senderFrame: { url: "app" } } as IpcMainInvokeEvent, ...args);
}

const folder = mkdtempSync(join(tmpdir(), "webforge-keys-"));
afterAll(() => rmSync(folder, { recursive: true, force: true }));

/** A file in the test's folder holding `text`. */
function file(name: string, text: string): string {
  const path = join(folder, name);
  writeFileSync(path, text);
  return path;
}

/** A port nothing listens on: one a server had, closed again. */
async function closedPort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as { port: number };
  await new Promise<void>((resolve) => server.close(() => resolve()));
  return port;
}

const rsa = (passphrase?: string) =>
  generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: {
      type: "pkcs1",
      format: "pem",
      ...(passphrase === undefined ? {} : { cipher: "aes-256-cbc", passphrase }),
    },
  });

describe("Test connection (4.3)", () => {
  it("doesn't connect to an SFTP host whose key isn't trusted yet", async () => {
    expect(
      await testConnection(
        {
          protocol: "sftp",
          host: "127.0.0.1",
          port: await closedPort(),
          user: "baker",
          folder: "/site",
          signIn: "password",
        },
        { password: "test-only-password" },
        {},
        createKeyFiles(),
      ),
    ).toEqual({ ok: false, code: "untrusted-host" });
  });

  it("signs in to FTP with a password only", async () => {
    const keys = createKeyFiles();
    expect(
      await testConnection(
        { protocol: "ftps", host: "127.0.0.1", user: "baker", folder: "/site" },
        { keyHandle: keys.hold(rsa().privateKey) },
        {},
        keys,
      ),
    ).toEqual({ ok: false, code: "unauthorized" });
  });

  it("signs in with a key only by a handle main holds: one it doesn't is bad-key", async () => {
    expect(
      await testConnection(
        {
          protocol: "sftp",
          host: "127.0.0.1",
          user: "baker",
          folder: "/site",
          signIn: "key",
        },
        { keyHandle: "6f1c2b3a-1111-4222-8333-444455556666" },
        { hostKey: `SHA256:${"A".repeat(43)}` },
        createKeyFiles(),
      ),
    ).toEqual({ ok: false, code: "bad-key" });
    // The renderer can't send a key's text instead of its handle.
    await expect(
      invoker("publish:testConnection")(
        { protocol: "sftp", host: "127.0.0.1", user: "baker", folder: "/site", signIn: "key" },
        { privateKey: rsa().privateKey },
        {},
      ),
    ).rejects.toThrow();
  });

  it("holds the last 16 keys chosen, forgetting the oldest", () => {
    const keys = createKeyFiles();
    const first = keys.hold("first key");
    const handles = Array.from({ length: 16 }, (_, index) => keys.hold(`key ${index}`));

    expect(keys.get(first)).toBeUndefined();
    expect(handles.map((handle) => keys.get(handle))).toEqual(
      Array.from({ length: 16 }, (_, index) => `key ${index}`),
    );
  });

  it("says an unreachable host is unreachable, through the IPC call", async () => {
    const port = await closedPort();
    const test = invoker("publish:testConnection");

    expect(
      await test(
        { protocol: "ftps", host: "127.0.0.1", port, user: "baker", folder: "/site" },
        { password: "test-only-password" },
        {},
      ),
    ).toEqual({ ok: false, code: "network" });
    // What the renderer sends is checked: no destination without a host.
    await expect(
      test({ protocol: "ftps", host: "", user: "baker", folder: "/site" }, { password: "x" }, {}),
    ).rejects.toThrow();
  });

  it("can't read a host key from a host that isn't there", async () => {
    expect(await readHostKey("127.0.0.1", await closedPort(), 2_000)).toEqual({
      status: "failed",
      code: "network",
    });
  });
});

describe("the private key file (4.3)", () => {
  it("reads a private key, saying whether it needs its passphrase", async () => {
    const keys = createKeyFiles();
    const key = rsa().privateKey;
    const chosen = await readKeyFile(file("id_rsa", key), keys);
    expect(chosen).toMatchObject({ status: "chosen", name: "id_rsa", encrypted: false });
    // Main holds the key; the renderer gets its handle, never its text.
    expect(JSON.stringify(chosen)).not.toContain("PRIVATE KEY");
    expect(chosen.status === "chosen" ? keys.get(chosen.handle) : undefined).toBe(key);
    expect(
      await readKeyFile(file("locked", rsa("test-only-passphrase").privateKey), keys),
    ).toMatchObject({ status: "chosen", encrypted: true });
  });

  it("refuses a public key, another file, one too large, and one that isn't there", async () => {
    expect(await readKeyFile(file("id_rsa.pub", rsa().publicKey), createKeyFiles())).toEqual({
      status: "failed",
      reason: "not-a-key",
    });
    expect(await readKeyFile(file("big", "x".repeat(20_000)), createKeyFiles())).toEqual({
      status: "failed",
      reason: "too-large",
    });
    expect(await readKeyFile(join(folder, "missing"), createKeyFiles())).toEqual({
      status: "failed",
      reason: "unreadable",
    });
  });

  it("is cancelled with the dialog, and read once chosen", async () => {
    expect(await invoker("publish:chooseKeyFile")()).toEqual({ status: "cancelled" });
    const path = file("chosen", rsa().privateKey);
    expect(await invoker("publish:chooseKeyFile", async () => path)()).toMatchObject({
      status: "chosen",
      name: "chosen",
    });
  });

  it("refuses a renderer it does not trust", async () => {
    await expect(invoker("publish:chooseKeyFile", undefined, false)()).rejects.toThrow();
  });
});
