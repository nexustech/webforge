import { readFileSync } from "node:fs";
import { join } from "node:path";
import { tempDirFactory } from "@webforge/test-utils/vitest";
import { describe, expect, it, vi } from "vitest";
import {
  type AiApps,
  aiAppsFileSchema,
  cleanAppName,
  createAiApps,
  type NewPairing,
  NO_AI_APPS,
  UNCLAIMED_KEY_MS,
} from "./ai-apps.js";
import { createCredentialStore, mcpCredentialKey, type SecretCipher } from "./credential-store.js";
import { createJsonStore } from "./json-store.js";

const cipher: SecretCipher = {
  isEncryptionAvailable: async () => true,
  encryptString: async (text) => Buffer.from(`enc:${[...text].reverse().join("")}`),
  decryptString: async (data) => ({
    result: [...data.toString().slice(4)].reverse().join(""),
    shouldReEncrypt: false,
  }),
};

const tempDir = tempDirFactory("webforge-ai-apps-");

/** `name` paired, as it must be. */
async function pair(apps: Pick<AiApps, "add">, name: string): Promise<NewPairing> {
  const pairing = await apps.add(name, "other");
  if (pairing.status !== "paired") throw new Error(`not paired: ${pairing.status}`);
  return pairing;
}

/** The paired apps in a new folder, at a time the test moves on. */
function setUp() {
  const dir = tempDir();
  let time = 1_000_000;
  const credentials = createCredentialStore(join(dir, "credentials.json"), cipher);
  const file = createJsonStore(join(dir, "ai-apps.json"), aiAppsFileSchema, {
    empty: NO_AI_APPS,
    onDamaged: "move-aside",
  });
  /** How long each held-back answer waited; nothing waits in a test. */
  const waited: number[] = [];
  const apps = createAiApps(
    file,
    credentials,
    () => time,
    async (ms) => {
      waited.push(ms);
    },
  );
  return {
    dir,
    apps,
    credentials,
    waited,
    later: (ms: number) => {
      time += ms;
    },
  };
}

describe("paired AI apps (4.9, ADR 0021)", () => {
  it("pairs an app with a key of 256 bits, shown once, keeping only its hash", async () => {
    const { dir, apps, credentials } = setUp();

    const { app, key, proof } = await pair(apps, "  Claude\n Desktop ");

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
    const claude = await pair(apps, "Claude");
    const cursor = await pair(apps, "Cursor");

    expect(await apps.authenticate(claude.key)).toEqual({ id: claude.app.id, name: "Claude" });
    expect(await apps.authenticate(cursor.key)).toEqual({ id: cursor.app.id, name: "Cursor" });
    expect(await apps.authenticate(`${claude.key}x`)).toBeUndefined();
    expect((await apps.list()).every((app) => app.claimedAt !== null)).toBe(true);
  });

  it("revokes a key not used within 5 minutes, and keeps one that was", async () => {
    const { apps, credentials, later } = setUp();
    const used = await pair(apps, "Claude");
    const unused = await pair(apps, "Cursor");
    await apps.authenticate(used.key);

    later(UNCLAIMED_KEY_MS + 1);

    expect(await apps.authenticate(unused.key)).toBeUndefined();
    expect((await apps.list()).map((app) => app.name)).toEqual(["Claude"]);
    expect(await credentials.get(mcpCredentialKey(unused.app.id))).toBeNull();
    expect(await apps.authenticate(used.key)).toMatchObject({ name: "Claude" });
  });

  it("cuts off a removed app, its secrets with it", async () => {
    const { apps, credentials } = setUp();
    const { app, key } = await pair(apps, "Claude");

    await apps.remove(app.id);

    expect(await apps.authenticate(key)).toBeUndefined();
    expect(await apps.list()).toEqual([]);
    expect(await credentials.get(mcpCredentialKey(app.id))).toBeNull();
  });

  it("always accepts a right key, and holds back wrong ones' answers after a few, never for long (#746 review)", async () => {
    const { apps, waited, later } = setUp();
    const { key } = await pair(apps, "Claude");
    const wrong = "w".repeat(43);

    for (let attempt = 0; attempt < 3; attempt++) await apps.authenticate(wrong);
    // Three wrong keys, as any program on the computer can send: a right one is let in at once.
    expect(await apps.authenticate(key)).toMatchObject({ name: "Claude" });
    expect(waited).toEqual([250]);

    // Each further wrong key waits longer, doubling, never past 2 s.
    for (let attempt = 0; attempt < 5; attempt++) await apps.authenticate(wrong);
    expect(waited).toEqual([250, 500, 1_000, 2_000, 2_000, 2_000]);
    expect(await apps.authenticate(key)).toMatchObject({ name: "Claude" });

    // A minute later, wrong keys are answered at once again.
    later(60_001);
    await apps.authenticate(wrong);
    expect(waited).toHaveLength(6);
  });

  it("remembers the port it was given", async () => {
    const { apps } = setUp();
    expect(await apps.port()).toBeNull();

    await apps.setPort(51_234);

    expect(await apps.port()).toBe(51_234);
  });

  it("refuses a name another paired app has, whatever its case, so each app's changes are its own", async () => {
    const { apps } = setUp();
    await pair(apps, "Claude");

    expect(await apps.add(" claude ", "other")).toEqual({ status: "name-taken" });
    expect((await pair(apps, "Claude Code")).app.name).toBe("Claude Code");
    expect((await apps.list()).map((app) => app.name)).toEqual(["Claude", "Claude Code"]);
  });

  it("cleans a name to one line without control characters, and refuses an empty one", async () => {
    expect(cleanAppName("Claude\u0000\u202e Code\r\n")).toBe("Claude Code");
    expect(cleanAppName("x".repeat(200))).toHaveLength(80);
    expect(await setUp().apps.add(" \n ", "other")).toEqual({ status: "name-empty" });
  });
});

describe("the paired apps under a flood of wrong keys (S28, #794)", () => {
  it("reads the apps file once, keeping it in memory, and writes every change through", async () => {
    const dir = tempDir();
    const store = createJsonStore(join(dir, "ai-apps.json"), aiAppsFileSchema, {
      empty: NO_AI_APPS,
      onDamaged: "move-aside",
    });
    let reads = 0;
    const counted = {
      ...store,
      read: async () => {
        reads += 1;
        return store.read();
      },
    };
    const apps = createAiApps(
      counted,
      createCredentialStore(join(dir, "credentials.json"), cipher),
      Date.now,
      async () => undefined,
    );
    const { key } = await pair(apps, "Cursor");

    for (let n = 0; n < 50; n++) await apps.authenticate("x".repeat(43));
    expect(await apps.authenticate(key)).toMatchObject({ name: "Cursor" });

    expect(reads).toBe(1);
    // What's kept is what's written: the claim is in the file.
    const saved = aiAppsFileSchema.parse(
      JSON.parse(readFileSync(join(dir, "ai-apps.json"), "utf8")),
    );
    expect(saved.apps[0]?.claimedAt).not.toBeNull();
  });

  it("holds back at most 16 wrong keys at once, answering the rest at once, and never a right key", async () => {
    const dir = tempDir();
    const releases: (() => void)[] = [];
    const apps = createAiApps(
      createJsonStore(join(dir, "ai-apps.json"), aiAppsFileSchema, {
        empty: NO_AI_APPS,
        onDamaged: "move-aside",
      }),
      createCredentialStore(join(dir, "credentials.json"), cipher),
      () => 1_000_000,
      // Held back until the test lets them go.
      () =>
        new Promise<void>((resolve) => {
          releases.push(resolve);
        }),
    );
    const { key } = await pair(apps, "Cursor");
    const wrong = () => apps.authenticate("x".repeat(43));
    // The first two wrong keys in the minute are answered at once.
    for (let n = 0; n < 2; n++) await wrong();

    const held = Array.from({ length: 16 }, wrong);
    await vi.waitFor(() => expect(releases).toHaveLength(16));
    // The 17th and later are answered at once; so is a right key.
    expect(await wrong()).toBeUndefined();
    expect(await apps.authenticate(key)).toMatchObject({ name: "Cursor" });
    expect(releases).toHaveLength(16);

    for (const release of releases) release();
    expect(await Promise.all(held)).toEqual(Array(16).fill(undefined));
  });

  it("holds back wrong keys' answers by a count in the minute, which starts again after it", async () => {
    const { apps, waited, later } = setUp();
    for (let n = 0; n < 6; n++) await apps.authenticate("x".repeat(43));
    expect(waited).toEqual([250, 500, 1_000, 2_000]);

    later(60_000);
    await apps.authenticate("x".repeat(43));
    expect(waited).toHaveLength(4);
  });
});
