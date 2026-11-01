import { readFileSync } from "node:fs";
import { join } from "node:path";
import { tempDirFactory } from "@webforge/test-utils/vitest";
import { describe, expect, it } from "vitest";
import {
  aiAppsFileSchema,
  cleanAppName,
  createAiApps,
  NO_AI_APPS,
  UNCLAIMED_KEY_MS,
} from "./ai-apps.js";
import { createCredentialStore, mcpCredentialKey, type SecretCipher } from "./credential-store.js";
import { createJsonStore } from "./json-store.js";

const cipher: SecretCipher = {
  isEncryptionAvailable: () => true,
  encryptString: (text) => Buffer.from(`enc:${[...text].reverse().join("")}`),
  decryptString: (data) => [...data.toString().slice(4)].reverse().join(""),
};

const tempDir = tempDirFactory("webforge-ai-apps-");

/** The paired apps in a new folder, at a time the test moves on. */
function setUp() {
  const dir = tempDir();
  let time = 1_000_000;
  const credentials = createCredentialStore(join(dir, "credentials.json"), cipher);
  const file = createJsonStore(join(dir, "ai-apps.json"), aiAppsFileSchema, {
    empty: NO_AI_APPS,
    onDamaged: "move-aside",
  });
  const apps = createAiApps(file, credentials, () => time);
  return {
    dir,
    apps,
    credentials,
    later: (ms: number) => {
      time += ms;
    },
  };
}

describe("paired AI apps (4.9, ADR 0021)", () => {
  it("pairs an app with a key of 256 bits, shown once, keeping only its hash", async () => {
    const { dir, apps, credentials } = setUp();

    const { app, key, proof } = await apps.add("  Claude\n Desktop ");

    expect(app).toMatchObject({ name: "Claude Desktop", claimedAt: null });
    expect(Buffer.from(key, "base64url")).toHaveLength(32);
    expect(Buffer.from(proof, "base64url")).toHaveLength(32);
    const stored = (await credentials.get(mcpCredentialKey(app.id))) ?? "";
    expect(stored).not.toContain(key);
    expect(readFileSync(join(dir, "ai-apps.json"), "utf8")).not.toContain(key);
    expect(await apps.list()).toEqual([app]);
    expect(await apps.proofOf(app.id)).toBe(proof);
  });

  it("knows an app by its key, which its first use claims, and no other", async () => {
    const { apps } = setUp();
    const claude = await apps.add("Claude");
    const cursor = await apps.add("Cursor");

    expect(await apps.authenticate(claude.key)).toEqual({ id: claude.app.id, name: "Claude" });
    expect(await apps.authenticate(cursor.key)).toEqual({ id: cursor.app.id, name: "Cursor" });
    expect(await apps.authenticate(`${claude.key}x`)).toBeUndefined();
    expect((await apps.list()).every((app) => app.claimedAt !== null)).toBe(true);
  });

  it("revokes a key not used within 5 minutes, and keeps one that was", async () => {
    const { apps, credentials, later } = setUp();
    const used = await apps.add("Claude");
    const unused = await apps.add("Cursor");
    await apps.authenticate(used.key);

    later(UNCLAIMED_KEY_MS + 1);

    expect(await apps.authenticate(unused.key)).toBeUndefined();
    expect((await apps.list()).map((app) => app.name)).toEqual(["Claude"]);
    expect(await credentials.get(mcpCredentialKey(unused.app.id))).toBeNull();
    expect(await apps.authenticate(used.key)).toMatchObject({ name: "Claude" });
  });

  it("cuts off a removed app, its secrets with it", async () => {
    const { apps, credentials } = setUp();
    const { app, key } = await apps.add("Claude");

    await apps.remove(app.id);

    expect(await apps.authenticate(key)).toBeUndefined();
    expect(await apps.list()).toEqual([]);
    expect(await credentials.get(mcpCredentialKey(app.id))).toBeNull();
  });

  it("backs off after three failures in a minute, doubling, a right key included", async () => {
    const { apps, later } = setUp();
    const { key } = await apps.add("Claude");
    const wrong = "w".repeat(43);

    for (let attempt = 0; attempt < 3; attempt++) await apps.authenticate(wrong);
    expect(await apps.authenticate(key)).toBeUndefined();
    later(1_001);
    expect(await apps.authenticate(key)).toMatchObject({ name: "Claude" });

    // A success starts the count again.
    for (let attempt = 0; attempt < 3; attempt++) await apps.authenticate(wrong);
    later(1_001);
    expect(await apps.authenticate(key)).toMatchObject({ name: "Claude" });
  });

  it("remembers the port it was given", async () => {
    const { apps } = setUp();
    expect(await apps.port()).toBeNull();

    await apps.setPort(51_234);

    expect(await apps.port()).toBe(51_234);
  });

  it("cleans a name to one line without control characters, and refuses an empty one", async () => {
    expect(cleanAppName("Claude\u0000‮ Code\r\n")).toBe("Claude Code");
    expect(cleanAppName("x".repeat(200))).toHaveLength(80);
    await expect(setUp().apps.add(" \n ")).rejects.toThrow();
  });
});
