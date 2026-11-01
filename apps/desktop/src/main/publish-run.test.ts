import { join } from "node:path";
import { createSite, type PublishDestination, type SiteDoc } from "@webforge/model";
import { ProjectStore } from "@webforge/storage";
import { tempDirFactory } from "@webforge/test-utils/vitest";
import type { IpcMain, IpcMainInvokeEvent } from "electron";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PublishJob, PublishOutcome } from "../shared/export-worker-protocol.js";
import type { ExportRunner } from "./export-worker-client.js";
import { type PublishRunDeps, registerPublishRun } from "./publish-run.js";

type Handler = (event: IpcMainInvokeEvent, ...args: unknown[]) => Promise<unknown>;

const SESSION = "0c1d2e3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f";
const OPERATION = "1d2e3f40-5b6c-4d7e-8f80-9a0b1c2d3e4f";
const TRUSTED = "<script>trusted()</script>";
const UNTRUSTED = "<script>untrusted()</script>";

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

/** Publish's handlers over a site file holding `site` and `destination`, open as `SESSION`. */
function handlers({
  site = publishable(),
  outcome = async (): Promise<PublishOutcome> => LIVE,
  signedIn = true,
  siteOpen = true,
}: {
  readonly site?: SiteDoc;
  readonly outcome?: (job: PublishJob, signal: AbortSignal | undefined) => Promise<PublishOutcome>;
  readonly signedIn?: boolean;
  readonly siteOpen?: boolean;
} = {}) {
  const store = ProjectStore.create(join(tempDir(), "site.wforge"), { name: "Rosa's" });
  open.push(store);
  store.saveSite(site);
  store.writePublishDestinations([destination]);
  const runner = {
    publish: vi.fn<ExportRunner["publish"]>(async (job, options) => {
      options.onProgress?.({ stage: "uploading", done: 1, total: 12 });
      return outcome(job, options.signal);
    }),
  };
  const sendProgress = vi.fn();
  const deps: PublishRunDeps = {
    site: () => ({
      withStore: async (_kind, work, none) => (siteOpen ? work(store) : none("no-site")),
      staleReason: () => (siteOpen ? undefined : "no-site"),
      readMedia: async () => undefined,
    }),
    secrets: {
      signInFor: async () =>
        signedIn ? { signIn: { password: "test-only-password" }, trust: {} } : undefined,
    },
    trusted: async () => (text: string) => text === TRUSTED,
    fontsOf: async () => ({ fonts: [], families: [] }),
    runner,
    sendProgress,
    now: () => new Date("2026-11-01T14:02:00Z"),
  };
  const registered = new Map<string, Handler>();
  const ipc = {
    handle: (name: string, handler: Handler) => registered.set(name, handler),
  } as unknown as Pick<IpcMain, "handle">;
  registerPublishRun(ipc, () => true, deps);
  const invoke = (channel: string, ...args: unknown[]) =>
    registered.get(channel)?.({ senderFrame: { url: "app" } } as IpcMainInvokeEvent, ...args);
  const publish = (replaceOtherSite = false) =>
    invoke("publish:publish", SESSION, destination.id, OPERATION, { replaceOtherSite });
  return { store, runner, sendProgress, invoke, publish };
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
      name: expect.stringMatching(/^Published /),
      publishedTo: {
        destinationId: destination.id,
        publishedAt: "2026-11-01T14:02:00.000Z",
        check: "live",
      },
    });
    expect(store.readVersion(version?.id ?? "")?.map(({ id, kind }) => ({ id, kind }))).toEqual(
      manifest.map(({ id, kind }) => ({ id, kind })),
    );
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
