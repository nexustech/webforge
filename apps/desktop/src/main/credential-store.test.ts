import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tempDirFactory } from "@webforge/test-utils";
import { describe, expect, it } from "vitest";
import {
  CredentialError,
  createCredentialStore,
  credentialKey,
  type SecretCipher,
} from "./credential-store.js";

// A stand-in for safeStorage: reversible, and visibly not plain text.
const cipher = (available = true): SecretCipher => ({
  isEncryptionAvailable: () => available,
  encryptString: (text) => Buffer.from(`enc:${[...text].reverse().join("")}`),
  decryptString: (data) => {
    const text = data.toString();
    if (!text.startsWith("enc:")) throw new Error("Error while decrypting the ciphertext");
    return [...text.slice(4)].reverse().join("");
  },
});

describe("createCredentialStore", () => {
  const tempDir = tempDirFactory();
  const fileIn = (dir: string) => join(dir, "nested", "credentials.json");

  it("saves, reads and deletes secrets by key", async () => {
    const store = createCredentialStore(fileIn(tempDir()), cipher());
    const key = credentialKey("project-1", "live");

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

describe("credentialKey", () => {
  it("keeps project and profile apart even when they contain the separator", () => {
    expect(credentialKey("a/b", "c")).not.toBe(credentialKey("a", "b/c"));
  });
});
