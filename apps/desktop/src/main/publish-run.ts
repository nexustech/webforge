import { createHash } from "node:crypto";
import { t } from "@webforge/i18n";
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
import { saveSiteVersion } from "./site-versions.js";

/** What the publish calls reach outside themselves; fakes in tests. */
export type PublishRunDeps = {
  /** The open site as opening `sessionId` reaches it (A13): its file, its Media. */
  readonly site: (
    sessionId: string,
  ) => Pick<SiteStore, "withStore"> & Pick<SessionSite, "staleReason" | "readMedia">;
  readonly secrets: Pick<PublishSecrets, "signInFor">;
  /** Which of the site `projectId`'s code its owner trusts on this computer (#649). */
  readonly trusted: (projectId: string) => Promise<TrustedCode>;
  readonly fontsOf: SiteFonts["fontsOf"];
  /** The export worker's runner, which publishes too (ADR 0018 §1). */
  readonly runner: Pick<ExportRunner, "publish">;
  readonly sendProgress: (operationId: string, progress: PublishProgress) => void;
  /** Now, for the version's name and the publish record; the clock unless a test says. */
  readonly now?: () => Date;
};

/** What a publish reads of the site, in one turn of the event loop (ADR 0018 §3). */
type Read = {
  readonly site: SiteDoc;
  readonly manifest: VersionManifest;
  readonly destination: PublishDestination | undefined;
  readonly projectId: string;
};

const hashOf = (text: string) => createHash("sha256").update(text).digest("hex");

/** "Published 19 Oct, 14:02", in the system's own format. */
function versionName(at: Date): string {
  const when = new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(at);
  return t("publish.version.name", { when });
}

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
 * 1. reads the site, the manifest of its documents and the destination in one turn of main's
 *    event loop, so no autosave commit lands between them (§3), from the opening the call names
 *    (R6): the window has ended its text session and flushed autosave first;
 * 2. leaves out the code its owner hasn't trusted here (#649), and runs Site Check's publish gate
 *    on what is left (§4): any *Must fix* stops it, with nothing built or saved;
 * 3. reads the destination's sign-in from the keychain, only for the destination it was typed for
 *    (S2), and publishes in the export worker, the sign-in passed for that job only (§1);
 * 4. once it is live, whatever the live check found, saves the "Published …" version from the
 *    manifest it read, recording where it went; a publish that fails or is cancelled saves none.
 */
export function registerPublishRun(
  ipc: Pick<IpcMain, "handle">,
  isTrustedSender: (senderUrl: string) => boolean,
  deps: PublishRunDeps,
): void {
  const underWay = new Map<string, AbortController>();
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
      try {
        // 1. All at once: `work` is synchronous, so nothing commits in between.
        const read = await site.withStore<Read | { readonly reason: "no-site" | "stale-session" }>(
          "shared",
          (store) => ({
            site: store.readSite(),
            manifest: store.readManifest(),
            destination: store.readPublishDestinations().find(({ id }) => id === destinationId),
            projectId: store.info.projectId,
          }),
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

        // 4. Live: the version it built, from the manifest read with it.
        const at = now();
        const version = await saveSiteVersion(site, versionName(at), "on-publish", {
          documents: manifest,
          publishedTo: {
            destinationId,
            publishedAt: at.toISOString(),
            check: outcome.check,
            ...(outcome.version === undefined ? {} : { deploy: outcome.version }),
          },
        });
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
        underWay.delete(operationId);
      }
    },
  );

  registerIpcHandler(ipc, "publishCancel", isTrustedSender, (operationId) => {
    underWay.get(operationId)?.abort();
    return null;
  });
}

/** Publish as a feature of the app (4.5, A12). */
export function publishRunFeature(deps: PublishRunDeps): AppFeature {
  return { register: (ipc, isTrustedSender) => registerPublishRun(ipc, isTrustedSender, deps) };
}
