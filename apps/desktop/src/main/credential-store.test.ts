import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tempDirFactory } from "@webforge/test-utils/vitest";
import { describe, expect, it } from "vitest";
import {
  CredentialError,
  createCredentialStore,
  mcpCredentialKey,
  publishCredentialKey,
  type SecretCipher,
} from "./credential-store.js";

// A stand-in for safeStorage: reversible, and visibly not plain text.
// `old:` is the same under a key the OS has since replaced, which safeStorage asks to encrypt again.
const cipher = (available = true): SecretCipher => ({
  isEncryptionAvailable: async () => available,
  encryptString: async (text) => Buffer.from(`enc:${[...text].reverse().join("")}`),
  decryptString: async (data) => {
    const text = data.toString();
    if (!text.startsWith("enc:") && !text.startsWith("old:")) {
      throw new Error("Error while decrypting the ciphertext");
    }
    return {
      result: [...text.slice(4)].reverse().join(""),
      shouldReEncrypt: text.startsWith("old:"),
    };
  },
});

describe("createCredentialStore", () => {
  const tempDir = tempDirFactory();
  const fileIn = (dir: string) => join(dir, "nested", "credentials.json");

  it("encrypts a secret again once the OS's key has changed (Electron 45's safeStorage, #832)", async () => {
    const dir = tempDir();
    const file = fileIn(dir);
    mkdirSync(join(dir, "nested"));
    const old = Buffer.from("old:terces_pfn").toString("base64");
    writeFileSync(file, JSON.stringify({ version: 1, secrets: { k: old } }));

    expect(await createCredentialStore(file, cipher()).get("k")).toBe("nfp_secret");
    const saved = JSON.parse(readFileSync(file, "utf8")) as { secrets: { k: string } };
    expect(Buffer.from(saved.secrets.k, "base64").toString()).toBe("enc:terces_pfn");
  });

  it("keeps the secret as it was when encrypting it again fails, still readable (#843)", async () => {
    const dir = tempDir();
    const file = fileIn(dir);
    mkdirSync(join(dir, "nested"));
    const old = Buffer.from("old:terces_pfn").toString("base64");
    const before = JSON.stringify({ version: 1, secrets: { k: old } });
    writeFileSync(file, before);
    const failing: SecretCipher = {
      ...cipher(),
      encryptString: async () => {
        throw new Error("The OS refused to encrypt");
      },
    };
    const store = createCredentialStore(file, failing);

    expect(await store.get("k")).toBe("nfp_secret");
    expect(readFileSync(file, "utf8")).toBe(before);
    // And again: it's still there to read, and to encrypt again another time.
    expect(await store.get("k")).toBe("nfp_secret");
  });

  it("leaves a secret changed or deleted while it was encrypted again as it then is (#843 review)", async () => {
    const dir = tempDir();
    const file = fileIn(dir);
    mkdirSync(join(dir, "nested"));
    const old = Buffer.from("old:terces_pfn").toString("base64");
    writeFileSync(file, JSON.stringify({ version: 1, secrets: { changed: old, deleted: old } }));
    // Encrypting again waits until the test has changed the file.
    let go: () => void = () => undefined;
    const waiting = new Promise<void>((resolve) => {
      go = resolve;
    });
    const plain = cipher();
    const slow: SecretCipher = {
      ...plain,
      encryptString: async (text) => {
        await waiting;
        return plain.encryptString(text);
      },
    };
    const store = createCredentialStore(file, slow);
    const writer = createCredentialStore(file, cipher());

    const reading = Promise.all([store.get("changed"), store.get("deleted")]);
    // Both read and decrypted, and waiting to be encrypted again.
    await new Promise((resolve) => setTimeout(resolve, 20));
    await writer.set("changed", "nfp_newer");
    await writer.delete("deleted");
    go();

    expect(await reading).toEqual(["nfp_secret", "nfp_secret"]);
    expect(await writer.get("changed")).toBe("nfp_newer");
    expect(await writer.get("deleted")).toBeNull();
  });

  it("saves, reads and deletes secrets by key", async () => {
    const store = createCredentialStore(fileIn(tempDir()), cipher());
    const key = publishCredentialKey("project-1", "live");

    expect(await store.get(key)).toBeNull();
    await store.set(key, "nfp_secret");
    expect(await store.get(key)).toBe("nfp_secret");

    await store.delete(key);
    expect(await store.get(key)).toBeNull();
    await expect(store.delete(key)).resolves.toBeUndefined();
  });

  it("never writes the secret in plain text", async () => {
    const file = fileIn(tempDir());
    await createCredentialStore(file, cipher()).set("k", "nfp_secret");

    const text = readFileSync(file, "utf8");
    expect(text).not.toContain("nfp_secret");
    expect(JSON.parse(text)).toEqual({
      version: 1,
      secrets: { k: Buffer.from("enc:terces_pfn").toString("base64") },
    });
  });

  it("refuses to save when the OS can't encrypt", async () => {
    const file = fileIn(tempDir());
    const store = createCredentialStore(file, cipher(false));

    const error = await store.set("k", "nfp_secret").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(CredentialError);
    expect(error).toMatchObject({ code: "encryption-unavailable" });
    expect(() => readFileSync(file)).toThrow();
  });

  it("keeps other keys and survives a restart", async () => {
    const file = fileIn(tempDir());
    const first = createCredentialStore(file, cipher());
    await Promise.all([first.set("a", "one"), first.set("b", "two"), first.set("c", "three")]);
    await first.delete("b");

    const second = createCredentialStore(file, cipher());
    expect([await second.get("a"), await second.get("b"), await second.get("c")]).toEqual([
      "one",
      null,
      "three",
    ]);
  });

  it("treats a damaged file or undecryptable secret as missing", async () => {
    const dir = tempDir();
    const damaged = join(dir, "damaged.json");
    writeFileSync(damaged, "{ not json");
    expect(await createCredentialStore(damaged, cipher()).get("k")).toBeNull();

    const foreign = join(dir, "foreign.json");
    writeFileSync(foreign, JSON.stringify({ version: 1, secrets: { k: "bm90LW91cnM=" } }));
    expect(await createCredentialStore(foreign, cipher()).get("k")).toBeNull();
    // Object built-ins are not secrets.
    expect(await createCredentialStore(foreign, cipher()).get("constructor")).toBeNull();
  });

  it("moves a file that won't parse aside before saving, never writing over it (#666)", async () => {
    const dir = tempDir();
    const file = join(dir, "credentials.json");
    writeFileSync(file, '{ "version": 1, "secrets": { "old": "a'); // cut off mid-write
    const store = createCredentialStore(file, cipher());

    expect(await store.get("old")).toBeNull();
    await store.set("new", "fresh");

    expect(await store.get("new")).toBe("fresh");
    const aside = readdirSync(dir).filter((name) => name.startsWith("credentials.damaged-"));
    expect(aside).toHaveLength(1);
    expect(readFileSync(join(dir, aside[0] ?? ""), "utf8")).toBe(
      '{ "version": 1, "secrets": { "old": "a',
    );
  });

  it("doesn't save over a file it couldn't read, which would lose other secrets", async () => {
    const dir = tempDir();
    // A folder where the file should be: reading fails with something other than "not found".
    const file = join(dir, "credentials.json");
    mkdirSync(file);
    const store = createCredentialStore(file, cipher());

    await expect(store.set("k", "v")).rejects.toMatchObject({ code: "read-failed" });
    await expect(store.delete("k")).rejects.toMatchObject({ code: "read-failed" });
    expect(await store.get("k")).toBeNull();
  });

  it("reports a file it can't write", async () => {
    const dir = tempDir();
    writeFileSync(join(dir, "blocker"), "a file where a folder should be");

    await expect(
      createCredentialStore(join(dir, "blocker", "credentials.json"), cipher()).set("k", "v"),
    ).rejects.toMatchObject({ code: "write-failed" });
  });
});

describe("credential keys (#666)", () => {
  it("are namespaced, and keep their parts apart even when they contain the separator", () => {
    expect(publishCredentialKey("p-1", "d-1")).toBe("publish/p-1/d-1");
    expect(mcpCredentialKey("claude")).toBe("mcp/claude");
    expect(publishCredentialKey("a/b", "c")).not.toBe(publishCredentialKey("a", "b/c"));
    // An AI app named like a destination's key stays in its own namespace.
    expect(mcpCredentialKey("publish/p-1/d-1")).toBe("mcp/publish%2Fp-1%2Fd-1");
  });
});
