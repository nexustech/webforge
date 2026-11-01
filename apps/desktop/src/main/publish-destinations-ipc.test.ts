import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  type FileTransferDestination,
  PUBLISH_DESTINATIONS_MAX,
  type PublishDestination,
} from "@webforge/model";
import { ProjectStore } from "@webforge/storage";
import { tempDirFactory } from "@webforge/test-utils/vitest";
import type { IpcMain, IpcMainInvokeEvent } from "electron";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createCredentialStore, type SecretCipher } from "./credential-store.js";
import { type DestinationsDeps, registerDestinationHandlers } from "./publish-destinations-ipc.js";
import { createPublishSecrets } from "./publish-secrets.js";
import type { SiteStore } from "./site-store.js";

type Handler = (event: IpcMainInvokeEvent, ...args: unknown[]) => Promise<unknown>;

const SESSION = "0c1d2e3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f";
const HOST_KEY = `SHA256:${"a".repeat(43)}`;
const PASSWORD = "test-only-hunter2";

// A stand-in for safeStorage: reversible, and visibly not plain text.
const cipher = (available = true): SecretCipher => ({
  isEncryptionAvailable: () => available,
  encryptString: (text) => Buffer.from(`enc:${[...text].reverse().join("")}`),
  decryptString: (data) => [...data.toString().slice(4)].reverse().join(""),
});

const sftp: FileTransferDestination = {
  protocol: "sftp",
  host: "ftp.example.com",
  user: "rosa",
  folder: "/www",
  signIn: "password",
};

const tempDir = tempDirFactory();
const open: ProjectStore[] = [];
afterEach(() => {
  for (const store of open.splice(0)) store.close();
});

/** The destinations' handlers over a new site file, open as `SESSION` unless `siteOpen` is false. */
function handlers({ keychain = true, readOnly = false, siteOpen = true } = {}) {
  const dir = tempDir();
  const path = join(dir, "site.wforge");
  ProjectStore.create(path, { name: "Rosa's Bakery" }).close();
  const store = ProjectStore.open(path, { readOnly });
  open.push(store);
  const credentials = join(dir, "credentials.json");
  const secrets = createPublishSecrets(createCredentialStore(credentials, cipher(keychain)));
  const site: Pick<SiteStore, "withStore"> = {
    withStore: async (_kind, work, none) => (siteOpen ? work(store) : none("no-site")),
  };
  const keys = new Map([["5d6e7f80-1a2b-4c3d-8e4f-5a6b7c8d9e0f", "PRIVATE KEY TEXT"]]);
  const test = vi.fn<DestinationsDeps["test"]>(async () => ({ ok: true }));
  const registered = new Map<string, Handler>();
  const ipc = {
    handle: (name: string, handler: Handler) => registered.set(name, handler),
  } as unknown as Pick<IpcMain, "handle">;
  registerDestinationHandlers(ipc, () => true, {
    site: () => site,
    secrets,
    keys: { get: (handle) => keys.get(handle) },
    test,
  });
  const invoke = (channel: string, ...args: unknown[]) =>
    registered.get(channel)?.({ senderFrame: { url: "app" } } as IpcMainInvokeEvent, ...args);
  const save = (draft: unknown, signIn: unknown, trust: unknown = { hostKey: HOST_KEY }) =>
    invoke("publish:saveDestination", SESSION, draft, signIn, trust) as Promise<
      { status: "saved"; destination: PublishDestination } | { status: string; reason?: string }
    >;
  const list = () => invoke("publish:destinations", SESSION);
  return { store, path, credentials, secrets, invoke, save, list, test };
}

/** The id of the destination a save gave back. */
function savedId(result: unknown): string {
  const saved = result as { status: string; destination?: PublishDestination };
  if (saved.destination === undefined) throw new Error(`Not saved: ${saved.status}`);
  return saved.destination.id;
}

describe("the destinations' calls (4.4a, ADR 0018 §2)", () => {
  it("adds a destination: its settings to the site file, its sign-in and trust never there", async () => {
    const { store, path, credentials, save, list } = handlers();
    expect(await list()).toEqual({ status: "listed", destinations: [] });

    const result = await save({ name: "My host", settings: sftp }, { password: PASSWORD });
    const id = savedId(result);

    expect(await list()).toEqual({
      status: "listed",
      destinations: [
        {
          destination: { id, name: "My host", kind: "file-transfer", settings: sftp },
          signIn: "saved",
          trust: { hostKey: HOST_KEY },
        },
      ],
    });
    store.close();
    open.splice(0);
    // Secrets never written to the .wforge (4.4a), nor the trust kept beside them (S2).
    const file = readFileSync(path);
    expect(file.includes(PASSWORD)).toBe(false);
    expect(file.includes(HOST_KEY)).toBe(false);
    expect(file.includes("ftp.example.com")).toBe(true);
    // And the keychain's file holds it encrypted, never as typed.
    expect(readFileSync(credentials, "utf8")).not.toContain(PASSWORD);
  });

  it("keeps the saved sign-in through an edit only while it is the same place (S2)", async () => {
    const { save, list, secrets, store } = handlers();
    const id = savedId(await save({ name: "My host", settings: sftp }, { password: PASSWORD }));

    // Renamed, another folder: the sign-in stays.
    const renamed = await save(
      { id, name: "Shop", settings: { ...sftp, folder: "/shop" } },
      { keep: true },
    );
    expect(renamed).toMatchObject({ status: "saved", destination: { name: "Shop" } });
    const destination = store.readPublishDestinations()[0];
    if (destination === undefined) throw new Error("No destination");
    expect((await secrets.signInFor(store.info.projectId, destination))?.signIn).toEqual({
      password: PASSWORD,
    });

    // Another host, or another host key: typed again, and nothing changed meanwhile.
    for (const [settings, trust] of [
      [{ ...sftp, host: "evil.example" }, { hostKey: HOST_KEY }],
      [sftp, { hostKey: `SHA256:${"b".repeat(43)}` }],
    ] as const) {
      expect(await save({ id, name: "Shop", settings }, { keep: true }, trust)).toEqual({
        status: "sign-in-needed",
      });
    }
    expect(await list()).toMatchObject({
      destinations: [{ destination: { name: "Shop" }, signIn: "saved" }],
    });
    // A new destination has nothing to keep.
    expect(await save({ name: "New", settings: sftp }, { keep: true })).toEqual({
      status: "sign-in-needed",
    });
  });

  it("saves an SFTP key by its handle, and refuses a handle no key is held under", async () => {
    const { save, secrets, store } = handlers();
    const settings = { ...sftp, signIn: "key" };
    const handle = "5d6e7f80-1a2b-4c3d-8e4f-5a6b7c8d9e0f";

    savedId(await save({ name: "Key", settings }, { keyHandle: handle, passphrase: "pass" }));
    const destination = store.readPublishDestinations()[0];
    if (destination === undefined) throw new Error("No destination");
    expect((await secrets.signInFor(store.info.projectId, destination))?.signIn).toEqual({
      privateKey: "PRIVATE KEY TEXT",
      passphrase: "pass",
    });

    const gone = { keyHandle: "6e7f8091-2b3c-4d4e-9f50-6b7c8d9e0f1a" };
    expect(await save({ name: "Lost", settings }, gone)).toEqual({
      status: "failed",
      reason: "bad-key",
    });
    expect(store.readPublishDestinations()).toHaveLength(1);
  });

  it("removes a destination with its sign-in", async () => {
    const { save, invoke, list, secrets, store } = handlers();
    const id = savedId(await save({ name: "My host", settings: sftp }, { password: PASSWORD }));
    const [destination] = store.readPublishDestinations();

    expect(await invoke("publish:removeDestination", SESSION, id)).toEqual({ status: "removed" });
    expect(await list()).toEqual({ status: "listed", destinations: [] });
    if (destination === undefined) throw new Error("No destination");
    expect(await secrets.signInFor(store.info.projectId, destination)).toBeUndefined();
  });

  it("refuses more destinations than a site may have", async () => {
    const { save, store } = handlers();
    store.writePublishDestinations(
      Array.from({ length: PUBLISH_DESTINATIONS_MAX }, (_, n) => ({
        id: `6f1c1b6e-8a3e-4c1e-9d55-${n.toString(16).padStart(12, "0")}`,
        name: `Host ${n}`,
        kind: "file-transfer" as const,
        settings: sftp,
      })),
    );

    expect(await save({ name: "One more", settings: sftp }, { password: PASSWORD })).toEqual({
      status: "failed",
      reason: "full",
    });
  });

  it("saves nothing without a keychain, nor to a read-only site, nor for a site gone", async () => {
    const noKeychain = handlers({ keychain: false });
    expect(
      await noKeychain.save({ name: "My host", settings: sftp }, { password: PASSWORD }),
    ).toEqual({
      status: "failed",
      reason: "no-keychain",
    });
    // The list went back as it was.
    expect(noKeychain.store.readPublishDestinations()).toEqual([]);

    const readOnly = handlers({ readOnly: true });
    expect(
      await readOnly.save({ name: "My host", settings: sftp }, { password: PASSWORD }),
    ).toEqual({
      status: "failed",
      reason: "read-only",
    });

    const closed = handlers({ siteOpen: false });
    expect(await closed.list()).toEqual({ status: "failed", reason: "no-site" });
    expect(await closed.save({ name: "My host", settings: sftp }, { password: PASSWORD })).toEqual({
      status: "failed",
      reason: "no-site",
    });
  });

  it("tests a saved destination with its sign-in, only as it was saved (S2)", async () => {
    const { save, invoke, test } = handlers();
    const id = savedId(await save({ name: "My host", settings: sftp }, { password: PASSWORD }));
    const testSaved = (settings: unknown, trust: unknown = { hostKey: HOST_KEY }) =>
      invoke("publish:testSavedDestination", SESSION, id, settings, trust);

    expect(await testSaved({ ...sftp, folder: "/shop" })).toEqual({ ok: true });
    expect(test).toHaveBeenCalledExactlyOnceWith(
      { ...sftp, folder: "/shop" },
      { password: PASSWORD },
      { hostKey: HOST_KEY },
    );

    expect(await testSaved({ ...sftp, host: "evil.example" })).toEqual({
      ok: false,
      code: "unauthorized",
    });
    expect(
      await invoke(
        "publish:testSavedDestination",
        SESSION,
        "6e7f8091-2b3c-4d4e-9f50-6b7c8d9e0f1a",
        sftp,
        { hostKey: HOST_KEY },
      ),
    ).toEqual({ ok: false, code: "unauthorized" });
    expect(test).toHaveBeenCalledOnce();
  });
});
