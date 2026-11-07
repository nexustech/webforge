import { createHash } from "node:crypto";
import {
  allowListText,
  type PublishDestination,
  type SiteDoc,
  siteCodePieces,
  withKeptCode,
} from "@webforge/model";
import { publishGate } from "@webforge/site-check";
import type { VersionManifest } from "@webforge/storage";
import type { IpcMain } from "electron";
import type { PublishOutcome } from "../shared/export-worker-protocol.js";
import type { PublishProgress, PublishResult } from "../shared/ipc/publish.js";
import type { AppFeature } from "./app-feature.js";
import type { TrustedCode } from "./code-trust.js";
import type { ExportRunner } from "./export-worker-client.js";
import { registerIpcHandler } from "./ipc.js";
import { logFailure } from "./log.js";
import type { SessionSite } from "./project-session.js";
import type { PublishSecrets } from "./publish-secrets.js";
import type { SiteFonts } from "./site-fonts.js";
import type { SiteStore } from "./site-store.js";

/** What the publish calls reach outside themselves; fakes in tests. */
export type PublishRunDeps = {
  /** The open site as opening `sessionId` reaches it (A13): its file, its Media. */
  readonly site: (
    sessionId: string,
  ) => Pick<SiteStore, "withStore"> &
    Pick<SessionSite, "staleReason" | "readMedia" | "saveVersion">;
  readonly secrets: Pick<PublishSecrets, "signInFor">;
  /** Which of the site `projectId`'s code its owner trusts on this computer (#649). */
  readonly trusted: (projectId: string) => Promise<TrustedCode>;
  readonly fontsOf: SiteFonts["fontsOf"];
  /** The export worker's runner, which publishes too (ADR 0018 §1). */
  readonly runner: Pick<ExportRunner, "publish">;
  /**
   * Asks the window to save its last changes (`app:flush`), as closing and Ctrl/Cmd+S do; resolves
   * once autosave has written them, or the window didn't answer in time.
   */
  readonly flush: () => Promise<void>;
  /**
   * Holds a publish's manifest until the returned release is called: Version History's Clean up
   * keeps every blob it reaches, for the build's images and the version it saves
   * (`ProjectSession.holdManifest`).
   */
  readonly holdManifest: (manifest: VersionManifest) => () => void;
  /** Opens an address in the default browser: `shell.openExternal`. */
  readonly openExternal: (url: string) => Promise<void>;
  readonly sendProgress: (operationId: string, progress: PublishProgress) => void;
  /** How many automatic versions the person keeps (Settings), pruned as one is saved. */
  readonly versionsKept: () => number;
  /** Now, for the publish record; the clock unless a test says. */
  readonly now?: () => Date;
};

/** What a publish reads of the site, in one turn of the event loop (ADR 0018 §3). */
type Read = {
  readonly site: SiteDoc;
  readonly manifest: VersionManifest;
  readonly destination: PublishDestination | undefined;
  readonly projectId: string;
};

/** How many publishes' addresses Open remembers. */
const LIVE_KEPT = 5;

const hashOf = (text: string) => createHash("sha256").update(text).digest("hex");

/** A failed publish's result, from the worker's outcome. */
function failedResult(outcome: Extract<PublishOutcome, { type: "failed" }>): PublishResult {
  return {
    status: "failed",
    reason: outcome.code,
    ...(outcome.page === undefined ? {} : { page: outcome.page }),
    ...(outcome.image === undefined ? {} : { image: outcome.image }),
  };
}

/**
 * Registers Publish's calls (4.5, ADR 0018): `publish:publish` and its cancel, each publish by the
 * renderer's operation id (#665), its progress sent as it goes. A publish:
 * 1. asks the window to flush autosave (the window ended its text session before calling), then
 *    reads the site, the manifest of its documents and the destination in one turn of main's
 *    event loop, so no autosave commit lands between them (§3), from the opening the call names
 *    (R6), and holds the manifest until the publish ends, so Clean up keeps what it reaches;
 * 2. leaves out the code its owner hasn't trusted here (#649), and runs Site Check's publish gate
 *    on what is left (§4): any *Must fix* stops it, with nothing built or saved;
 * 3. reads the destination's sign-in from the keychain, only for the destination it was typed for
 *    (S2), and publishes in the export worker, the sign-in passed for that job only (§1);
 * 4. once it is live, whatever the live check found, saves the version it went live with, from
 *    the manifest it read, recording where it went; a publish that fails or is cancelled saves
 *    none.
 */
export function registerPublishRun(
  ipc: Pick<IpcMain, "handle">,
  isTrustedSender: (senderUrl: string) => boolean,
  deps: PublishRunDeps,
): void {
  const underWay = new Map<string, AbortController>();
  // Where each recent publish went live, by its operation id: the only addresses Open opens.
  const live = new Map<string, string>();
  const now = deps.now ?? (() => new Date());

  registerIpcHandler(
    ipc,
    "publishSite",
    isTrustedSender,
    async (sessionId, destinationId, operationId, { replaceOtherSite }) => {
      const site = deps.site(sessionId);
      if (underWay.has(operationId)) return { status: "cancelled" };
      const controller = new AbortController();
      underWay.set(operationId, controller);
      let release: (() => void) | undefined;
      try {
        // 1. What the person sees, saved; then all at once: `work` is synchronous, so nothing
        // commits in between.
        await deps.flush();
        const read = await site.withStore<Read | { readonly reason: "no-site" | "stale-session" }>(
          "shared",
          (store) => {
            const manifest = store.readManifest();
            // Held in the same turn as it's read, so no Clean up comes between.
            release = deps.holdManifest(manifest);
            return {
              site: store.readSite(),
              manifest,
              destination: store.readPublishDestinations().find(({ id }) => id === destinationId),
              projectId: store.info.projectId,
            };
          },
          (reason) => ({ reason }),
        );
        if ("reason" in read) return { status: "failed", reason: read.reason };
        const { destination, projectId, manifest } = read;
        if (destination === undefined) return { status: "failed", reason: "no-destination" };

        // 2. Only the code its owner trusts goes in, and the gate checks what is left.
        const trusted = await deps.trusted(projectId);
        const kept = withKeptCode(read.site, trusted);
        const allowed = kept.settings.allowedExternalUrls;
        const allowListConfirmed = allowed.length === 0 || trusted(allowListText(allowed));
        const mustFix = publishGate(kept, { allowListConfirmed });
        if (mustFix > 0) return { status: "must-fix", count: mustFix };

        // 3. The sign-in, for this destination as the file names it now (S2).
        const saved = await deps.secrets.signInFor(projectId, destination);
        if (saved === undefined) return { status: "sign-in-needed" };
        if (controller.signal.aborted) return { status: "cancelled" };
        const outcome = await deps.runner.publish(
          {
            type: "publish",
            site: kept,
            destination,
            signIn: saved.signIn,
            trust: saved.trust,
            target: {
              site: { projectId, destinationId },
              ...(replaceOtherSite ? { replaceOtherSite: true } : {}),
            },
            trustedCode: siteCodePieces(kept).map((piece) => hashOf(piece.text)),
            ...(await deps.fontsOf(kept.theme)),
          },
          {
            // A site replaced while it publishes cancels it, as Cancel would (#663).
            readMedia: async (hash) => {
              const blob =
                site.staleReason() === undefined ? await site.readMedia(hash) : undefined;
              if (blob === undefined && site.staleReason() !== undefined) controller.abort();
              return blob;
            },
            signal: controller.signal,
            onProgress: (progress) => deps.sendProgress(operationId, progress),
          },
        );
        if (outcome.type === "cancelled") return { status: "cancelled" };
        if (outcome.type === "failed") return failedResult(outcome);

        // 4. Live: the version it built, from the manifest read with it. Like every automatic
        // version it has no name of its own: the list names it by its reason and time.
        const at = now();
        const version = await site.saveVersion({
          name: "",
          reason: "on-publish",
          thumbnail: undefined,
          kept: deps.versionsKept(),
          documents: manifest,
          publishedTo: {
            destinationId,
            publishedAt: at.toISOString(),
            check: outcome.check,
            ...(outcome.version === undefined ? {} : { deploy: outcome.version }),
          },
        });
        if (/^https?:\/\//.test(outcome.url)) {
          live.set(operationId, outcome.url);
          // The newest few only: an older publish's success screen has long closed.
          for (const old of live.keys()) if (live.size > LIVE_KEPT) live.delete(old);
        }
        return {
          status: "published",
          url: outcome.url,
          check: outcome.check,
          uploaded: outcome.uploaded,
          unchanged: outcome.unchanged,
          removed: outcome.removed,
          versionSaved: version.status === "saved",
        };
      } catch (error) {
        logFailure("Webforge could not publish the site", error);
        return { status: "failed", reason: "unknown" };
      } finally {
        release?.();
        underWay.delete(operationId);
      }
    },
  );

  registerIpcHandler(ipc, "publishCancel", isTrustedSender, (operationId) => {
    underWay.get(operationId)?.abort();
    return null;
  });

  registerIpcHandler(ipc, "publishOpenLive", isTrustedSender, async (operationId) => {
    const url = live.get(operationId);
    if (url === undefined) return false;
    try {
      await deps.openExternal(url);
      return true;
    } catch (error) {
      logFailure("Webforge could not open the published site", error);
      return false;
    }
  });
}

/** Publish as a feature of the app (4.5, A12). */
export function publishRunFeature(deps: PublishRunDeps): AppFeature {
  return { register: (ipc, isTrustedSender) => registerPublishRun(ipc, isTrustedSender, deps) };
}
