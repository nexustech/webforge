import { join } from "node:path";
import { createSite, type PublishDestination, type SiteDoc } from "@webforge/model";
import { ProjectStore } from "@webforge/storage";
import { tempDirFactory } from "@webforge/test-utils/vitest";
import type { IpcMain, IpcMainInvokeEvent } from "electron";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PublishJob, PublishOutcome } from "../shared/export-worker-protocol.js";
import type { ExportRunner } from "./export-worker-client.js";
import { type ClosableWindow, createFlushOnClose } from "./flush-on-close.js";
import { type PublishRunDeps, registerPublishRun } from "./publish-run.js";
import type { SiteStore } from "./site-store.js";
import { saveVersion } from "./site-versions.js";

type Handler = (event: IpcMainInvokeEvent, ...args: unknown[]) => Promise<unknown>;

const SESSION = "0c1d2e3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f";
const OPERATION = "1d2e3f40-5b6c-4d7e-8f80-9a0b1c2d3e4f";
const TRUSTED = "<script>trusted()</script>";
const UNTRUSTED = "<script>untrusted()</script>";
/** A script from another site, which the owner trusts: publishing it is a Must fix (X5). */
const EXTERNAL = '<script src="https://cdn.example.com/widget.js"></script>';

const destination: PublishDestination = {
  id: "6f1c1b6e-8a3e-4c1e-9d55-2f5c1e0a7b10",
  name: "Live",
  kind: "file-transfer",
  settings: { protocol: "ftps", host: "ftp.example.com", user: "rosa", folder: "/" },
};
const LIVE: PublishOutcome = {
  type: "published",
  url: "https://rosas.example/",
  uploaded: 12,
  unchanged: 0,
  removed: 1,
  check: "live",
  durationMs: 10,
};

const tempDir = tempDirFactory();
const open: ProjectStore[] = [];
afterEach(() => {
  for (const store of open.splice(0)) store.close();
});

/** A site that passes the publish gate: it has its web address. Its code is half trusted. */
function publishable(change: (site: SiteDoc) => void = () => undefined): SiteDoc {
  const site = createSite({
    name: "Rosa's",
    language: "en",
    homeTitle: "Home",
    notFoundTitle: "Oops",
  });
  site.settings.address.url = "https://rosas.example";
  site.code = { ...site.code, head: TRUSTED, bodyEnd: UNTRUSTED };
  change(site);
  return site;
}

/**
 * Publish's handlers over a site file holding `site` and `destination`, open as `SESSION`; with
 * `saved`, a version of that site saved before `site`, which `republish` publishes (4.6b).
 */
function handlers({
  saved,
  site = publishable(),
  outcome = async (): Promise<PublishOutcome> => LIVE,
  signedIn = true,
  siteOpen = true,
  saveFails = false,
  flushWith,
  to = destination,
  netlifyApi,
}: {
  readonly site?: SiteDoc;
  /** The destination published to; an SFTP host by default. */
  readonly to?: PublishDestination;
  /** Netlify's API, as an unpackaged app launched by the E2E tests has it (#70). */
  readonly netlifyApi?: string;
  readonly outcome?: (job: PublishJob, signal: AbortSignal | undefined) => Promise<PublishOutcome>;
  readonly signedIn?: boolean;
  readonly siteOpen?: boolean;
  readonly saveFails?: boolean;
  /** How the window's flush goes; at once by default. */
  readonly flushWith?: () => Promise<void>;
  readonly saved?: SiteDoc;
} = {}) {
  const store = ProjectStore.create(join(tempDir(), "site.wforge"), { name: "Rosa's" });
  open.push(store);
  let versionId = "5e6f7a8b-9c0d-4e1f-8a2b-3c4d5e6f7a8b";
  if (saved !== undefined) {
    store.saveSite(saved);
    versionId = store.saveVersion("Before the menu", "manual").id;
  }
  store.saveSite(site);
  store.writePublishDestinations([to]);
  const runner = {
    publish: vi.fn<ExportRunner["publish"]>(async (job, options) => {
      options.onProgress?.({ stage: "uploading", done: 1, total: 12 });
      return outcome(job, options.signal);
    }),
  };
  const sendProgress = vi.fn();
  const openExternal = vi.fn(async (_url: string) => undefined);
  // The manifests held now, as Clean up would keep them.
  const held = new Set<unknown>();
  const holdManifest = vi.fn((manifest: unknown) => {
    held.add(manifest);
    return () => {
      held.delete(manifest);
    };
  });
  // What happened, in order: the window's flush, then each read of the site's file.
  const order: string[] = [];
  const flush = vi.fn(async () => {
    order.push("flush");
    await flushWith?.();
  });
  const siteStore: Pick<SiteStore, "withStore"> = {
    withStore: async (_kind, work, none) => {
      order.push("read");
      return siteOpen ? work(store) : none("no-site");
    },
  };
  const deps: PublishRunDeps = {
    site: () => ({
      ...siteStore,
      staleReason: () => (siteOpen ? undefined : "no-site"),
      readMedia: async () => undefined,
      saveVersion: async (version) =>
        saveFails
          ? { status: "failed", reason: "read-only" }
          : saveVersion(siteStore as SiteStore, version),
    }),
    secrets: {
      signInFor: async () =>
        signedIn ? { signIn: { password: "test-only-password" }, trust: {} } : undefined,
    },
    trusted: async () => (text: string) => text === TRUSTED || text === EXTERNAL,
    fontsOf: async () => ({ fonts: [], families: [] }),
    runner,
    sendProgress,
    versionsKept: () => 30,
    flush,
    holdManifest,
    openExternal,
    now: () => new Date("2026-11-01T14:02:00Z"),
    ...(netlifyApi === undefined ? {} : { netlifyApi }),
  };
  const registered = new Map<string, Handler>();
  const ipc = {
    handle: (name: string, handler: Handler) => registered.set(name, handler),
  } as unknown as Pick<IpcMain, "handle">;
  registerPublishRun(ipc, () => true, deps);
  const invoke = (channel: string, ...args: unknown[]) =>
    registered.get(channel)?.({ senderFrame: { url: "app" } } as IpcMainInvokeEvent, ...args);
  const publish = (replaceOtherSite = false) =>
    invoke("publish:publish", SESSION, to.id, OPERATION, { replaceOtherSite });
  const republish = (id = versionId) =>
    invoke("publish:publish", SESSION, to.id, OPERATION, {
      replaceOtherSite: false,
      versionId: id,
    });
  return {
    store,
    runner,
    sendProgress,
    invoke,
    publish,
    republish,
    versionId,
    order,
    openExternal,
    held,
    holdManifest,
    flush,
  };
}

/** The job the runner was given. */
const jobOf = (runner: { publish: ReturnType<typeof vi.fn<ExportRunner["publish"]>> }) => {
  const job = runner.publish.mock.calls[0]?.[0];
  if (job === undefined) throw new Error("Nothing published");
  return job;
};

describe("Publish (4.5, ADR 0018)", () => {
  it("publishes the site as stored, then saves the version it built, recording where it went", async () => {
    const { store, runner, sendProgress, publish } = handlers();
    const manifest = store.readManifest();

    expect(await publish()).toEqual({
      status: "published",
      url: "https://rosas.example/",
      check: "live",
      uploaded: 12,
      unchanged: 0,
      removed: 1,
      versionSaved: true,
    });
    const job = jobOf(runner);
    expect(job).toMatchObject({
      type: "publish",
      destination,
      signIn: { password: "test-only-password" },
      target: { site: { projectId: store.info.projectId, destinationId: destination.id } },
    });
    expect(job.target.replaceOtherSite).toBeUndefined();
    expect(sendProgress).toHaveBeenCalledWith(OPERATION, {
      stage: "uploading",
      done: 1,
      total: 12,
    });

    const [version] = store.listVersions();
    expect(version).toMatchObject({
      reason: "on-publish",
      name: "",
      publishedTo: {
        destinationId: destination.id,
        publishedAt: "2026-11-01T14:02:00.000Z",
        check: "live",
      },
    });
    expect(store.readVersion(version?.id ?? "")?.map(({ id, kind }) => ({ id, kind }))).toEqual(
      manifest.map(({ id, kind }) => ({ id, kind })),
    );
    // When it went live, kept apart from the versions for Site Check (F-CM-8).
    expect(store.readLastPublishedAt()).toBe("2026-11-01T14:02:00.000Z");
  });

  it("sends a publish to Netlify to the API main was given, and nothing else there (#70)", async () => {
    const mock = "http://127.0.0.1:51234/api/v1";
    const netlify: PublishDestination = {
      id: "0b6a2c1e-7b3d-4a5e-9c8f-1d2e3f4a5b6c",
      name: "Netlify",
      kind: "netlify",
      siteId: "3c9b6a2e-1d4f-4e8a-9b7c-5a6d7e8f9a0b",
    };
    const toNetlify = handlers({ to: netlify, netlifyApi: mock });
    await toNetlify.publish();
    expect(jobOf(toNetlify.runner).netlifyApi).toBe(mock);

    // An SFTP host's job names no Netlify API; nor does one without the E2E tests' mock.
    const toHost = handlers({ netlifyApi: mock });
    await toHost.publish();
    expect(jobOf(toHost.runner).netlifyApi).toBeUndefined();
    const toNetlifyItself = handlers({ to: netlify });
    await toNetlifyItself.publish();
    expect(jobOf(toNetlifyItself.runner).netlifyApi).toBeUndefined();
  });

  it("republishes a version Netlify still keeps by its deploy, there only (#70)", async () => {
    const netlify: PublishDestination = {
      id: "0b6a2c1e-7b3d-4a5e-9c8f-1d2e3f4a5b6c",
      name: "Netlify",
      kind: "netlify",
      siteId: "3c9b6a2e-1d4f-4e8a-9b7c-5a6d7e8f9a0b",
    };
    const restored = async (job: PublishJob): Promise<PublishOutcome> =>
      job.restore === undefined ? LIVE : { ...LIVE, uploaded: 0, restored: true };
    const went = (destinationId: string) => ({
      destinationId,
      publishedAt: "2026-10-30T09:00:00.000Z",
      check: "live" as const,
      deploy: "deploy-7",
    });

    // Last live on this Netlify destination: its deploy is named, and the result says it's back.
    const here = handlers({ to: netlify, saved: publishable(), outcome: restored });
    here.store.recordPublish(here.versionId, went(netlify.id));
    expect(await here.republish()).toMatchObject({ status: "published", restored: true });
    expect(jobOf(here.runner).restore).toBe("deploy-7");

    // Live on another destination, or never: built as before.
    const elsewhere = handlers({ to: netlify, saved: publishable(), outcome: restored });
    elsewhere.store.recordPublish(elsewhere.versionId, went(destination.id));
    expect(await elsewhere.republish()).not.toHaveProperty("restored");
    expect(jobOf(elsewhere.runner).restore).toBeUndefined();
    const never = handlers({ to: netlify, saved: publishable(), outcome: restored });
    await never.republish();
    expect(jobOf(never.runner).restore).toBeUndefined();

    // A publish of the site as it is never restores, nor does a host that keeps no deploys.
    const fresh = handlers({ to: netlify, saved: publishable(), outcome: restored });
    fresh.store.recordPublish(fresh.versionId, went(netlify.id));
    await fresh.publish();
    expect(jobOf(fresh.runner).restore).toBeUndefined();
    const host = handlers({ saved: publishable(), outcome: restored });
    host.store.recordPublish(host.versionId, went(destination.id));
    await host.republish();
    expect(jobOf(host.runner).restore).toBeUndefined();
  });

  it("has the window save what the person sees before it reads the site (A4)", async () => {
    const { order, publish } = handlers();
    await publish();
    expect(order.slice(0, 2)).toEqual(["flush", "read"]);
  });

  it("reads the site anyway once a window that doesn't answer has had the close path's time", async () => {
    // The close path's own request, with a window that never says it has saved: the flush is
    // asked for before the gate is taken (autosave commits through it), and never blocks for ever.
    const flushOnClose = createFlushOnClose({ handle: () => undefined }, () => true, {
      timeoutMs: 20,
    });
    const silent = {
      on: vi.fn(),
      close: vi.fn(),
      isDestroyed: () => false,
      webContents: { send: vi.fn(), isCrashed: () => false, on: vi.fn() },
    } satisfies ClosableWindow;
    const { publish, order } = handlers({ flushWith: () => flushOnClose.requestFlush(silent) });

    expect(await publish()).toMatchObject({ status: "published" });
    expect(silent.webContents.send).toHaveBeenCalledWith("app:flush", expect.any(Number));
    expect(order.slice(0, 2)).toEqual(["flush", "read"]);
  });

  it.each([
    ["went live", LIVE],
    ["failed", { type: "failed", code: "network", detail: "network" }],
    ["was cancelled", { type: "cancelled" }],
  ] as const)(
    "holds the manifest it read while it publishes, and lets go once it %s",
    async (_, end) => {
      let heldDuring = 0;
      const { publish, held, holdManifest, store } = handlers({
        outcome: async () => {
          heldDuring = held.size;
          return end;
        },
      });
      await publish();

      expect(heldDuring).toBe(1);
      expect(holdManifest).toHaveBeenCalledWith(store.readManifest());
      expect(held.size).toBe(0);
      // Only a publish that went live is recorded as one (F-CM-8).
      expect(store.readLastPublishedAt()).toBe(
        end.type === "published" ? "2026-11-01T14:02:00.000Z" : undefined,
      );
    },
  );

  it("lets go of the manifest when the gate stops it", async () => {
    const { publish, held, holdManifest } = handlers({
      site: publishable((site) => {
        site.settings.address = {};
      }),
    });
    expect(await publish()).toMatchObject({ status: "must-fix" });
    expect(holdManifest).toHaveBeenCalledOnce();
    expect(held.size).toBe(0);
  });

  it("builds only the code its owner trusts here (#649)", async () => {
    const { runner, publish } = handlers();
    await publish();

    const { site } = jobOf(runner);
    expect(site.code.head).toBe(TRUSTED);
    expect(site.code.bodyEnd).toBe("");
    expect(jobOf(runner).trustedCode).toHaveLength(1);
  });

  it("passes on leave to replace another site's folder, once the person agreed (A8)", async () => {
    const { runner, publish } = handlers();
    await publish(true);
    expect(jobOf(runner).target.replaceOtherSite).toBe(true);
  });

  it("stops at the gate with what must be fixed, building and saving nothing (§4)", async () => {
    const { store, runner, publish } = handlers({
      site: publishable((site) => {
        site.settings.address = {};
      }),
    });

    expect(await publish()).toEqual({ status: "must-fix", count: 1 });
    expect(runner.publish).not.toHaveBeenCalled();
    expect(store.listVersions()).toEqual([]);
  });

  it("asks for the sign-in again when none is saved for the destination as it is (S2)", async () => {
    const { runner, publish } = handlers({ signedIn: false });
    expect(await publish()).toEqual({ status: "sign-in-needed" });
    expect(runner.publish).not.toHaveBeenCalled();
  });

  it("saves no version for a publish that failed or was cancelled", async () => {
    const failed = handlers({
      outcome: async () => ({ type: "failed", code: "other-site", detail: "other-site" }),
    });
    expect(await failed.publish()).toEqual({ status: "failed", reason: "other-site" });
    expect(failed.store.listVersions()).toEqual([]);

    // Cancel stops it: the worker sees the signal, and nothing is saved.
    const cancelled = handlers({
      outcome: async (_job, signal) =>
        new Promise<PublishOutcome>((resolve) => {
          signal?.addEventListener("abort", () => resolve({ type: "cancelled" }));
        }),
    });
    const publishing = cancelled.publish();
    await vi.waitFor(() => expect(cancelled.runner.publish).toHaveBeenCalled());
    expect(await cancelled.invoke("publish:cancel", OPERATION)).toBeNull();
    expect(await publishing).toEqual({ status: "cancelled" });
    expect(cancelled.store.listVersions()).toEqual([]);
  });

  it("still says the site is live when its version couldn't be saved", async () => {
    const { store, publish } = handlers({ saveFails: true });
    expect(await publish()).toMatchObject({ status: "published", versionSaved: false });
    expect(store.listVersions()).toEqual([]);
    // It went live all the same.
    expect(store.readLastPublishedAt()).toBe("2026-11-01T14:02:00.000Z");
  });

  it("opens only where a publish of its own went live (Open, 4.5)", async () => {
    const { invoke, publish, openExternal } = handlers();
    expect(await invoke("publish:open-live", OPERATION)).toBe(false);
    await publish();
    expect(await invoke("publish:open-live", OPERATION)).toBe(true);
    expect(openExternal).toHaveBeenCalledWith("https://rosas.example/");
    expect(await invoke("publish:open-live", "2e3f4051-6c7d-4e8f-9091-a1b2c3d4e5f6")).toBe(false);
    expect(openExternal).toHaveBeenCalledOnce();
  });

  it("answers for no other site, and no destination it doesn't have", async () => {
    expect(await handlers({ siteOpen: false }).publish()).toEqual({
      status: "failed",
      reason: "no-site",
    });
    const { invoke } = handlers();
    expect(
      await invoke("publish:publish", SESSION, "0b9a8f6e-3c2d-4e1f-8a7b-6c5d4e3f2a10", OPERATION, {
        replaceOtherSite: false,
      }),
    ).toEqual({ status: "failed", reason: "no-destination" });
  });
});

describe("Republish a version (4.6b, ADR 0018 §3)", () => {
  /** The site as it was: its own name, and its home page called otherwise. */
  const before = () =>
    publishable((site) => {
      site.settings.general.name = "Rosa's, as it was";
    });

  it("publishes the saved version, not the site as it is, and records where it went on it", async () => {
    const { store, runner, republish, versionId, flush, holdManifest } = handlers({
      saved: before(),
    });

    expect(await republish()).toMatchObject({ status: "published", versionSaved: true });
    const { site } = jobOf(runner);
    expect(site.settings.general.name).toBe("Rosa's, as it was");
    // Gated and built like any publish: only the code its owner trusts here (#649).
    expect(site.code.head).toBe(TRUSTED);
    expect(site.code.bodyEnd).toBe("");
    // The version is in the file already: nothing for the window to save, nothing new saved.
    expect(flush).not.toHaveBeenCalled();
    expect(holdManifest).toHaveBeenCalledWith(store.readVersionManifest(versionId));
    const versions = store.listVersions();
    expect(versions).toHaveLength(1);
    expect(versions[0]).toMatchObject({
      id: versionId,
      reason: "manual",
      publishedTo: {
        destinationId: destination.id,
        publishedAt: "2026-11-01T14:02:00.000Z",
        check: "live",
      },
    });
    // When it went live, for Site Check's year (F-CM-8), as a publish of the site records it.
    expect(store.readLastPublishedAt()).toBe("2026-11-01T14:02:00.000Z");
  });

  it("won't republish a version with a script from another site, building nothing (A6, X5)", async () => {
    const { store, runner, republish } = handlers({
      saved: publishable((site) => {
        site.code = { ...site.code, head: EXTERNAL };
      }),
    });

    expect(await republish()).toEqual({ status: "must-fix", count: 1 });
    expect(runner.publish).not.toHaveBeenCalled();
    expect(store.listVersions()[0]?.publishedTo).toBeUndefined();
    expect(store.readLastPublishedAt()).toBeUndefined();
  });

  it("gates the version, not the site as it is: a site with something to fix republishes a version without", async () => {
    const { runner, republish } = handlers({
      saved: before(),
      site: publishable((site) => {
        site.settings.address = {};
      }),
    });
    expect(await republish()).toMatchObject({ status: "published" });
    expect(runner.publish).toHaveBeenCalledOnce();
  });

  it("records nothing on the version when the republish fails or is cancelled", async () => {
    const { store, republish, held } = handlers({
      saved: before(),
      outcome: async () => ({ type: "failed", code: "network", detail: "network" }),
    });
    expect(await republish()).toEqual({ status: "failed", reason: "network" });
    expect(store.listVersions()[0]?.publishedTo).toBeUndefined();
    expect(store.readLastPublishedAt()).toBeUndefined();
    expect(held.size).toBe(0);
  });

  it("says when the version is no longer in the site, or can't be read", async () => {
    const gone = handlers({ saved: before() });
    expect(await gone.republish("0f1e2d3c-4b5a-4968-8776-655443322110")).toEqual({
      status: "failed",
      reason: "no-version",
    });
    expect(gone.runner.publish).not.toHaveBeenCalled();

    // A version from a newer Webforge's site format.
    const newer = handlers({
      saved: { ...before(), formatVersion: 999 } as unknown as SiteDoc,
    });
    expect(await newer.republish()).toEqual({ status: "failed", reason: "unreadable-version" });
    expect(newer.runner.publish).not.toHaveBeenCalled();
  });

  it("still says the site is live when the version went while it was republished", async () => {
    let deleted = false;
    const setUp = handlers({
      saved: before(),
      outcome: async () => {
        deleted = setUp.store.deleteVersion(setUp.versionId);
        return LIVE;
      },
    });
    expect(await setUp.republish()).toMatchObject({ status: "published", versionSaved: false });
    expect(deleted).toBe(true);
    expect(setUp.store.readLastPublishedAt()).toBe("2026-11-01T14:02:00.000Z");
  });
});
