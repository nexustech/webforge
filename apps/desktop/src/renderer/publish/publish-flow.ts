import { toast } from "@webforge/editor-ui";
import { plural, t } from "@webforge/i18n";
import { mediaItem, type PublishDestination, type SiteDoc, withKeptCode } from "@webforge/model";
import type { PublishApi, PublishProgress, PublishResult } from "../../shared/ipc/publish.js";
import { gateOnSiteCheck, runWithProgress } from "../editor/build-flow.js";
import type { CodeDecision } from "../editor/code-trust.js";
import { reportFailure } from "../log.js";

/** What a publish has reached, under the toast's "Publishing…"; counts start from 1. */
export function publishProgressText(progress: PublishProgress): string {
  switch (progress.stage) {
    case "images":
    case "pages":
    case "uploading":
      return t(`publish.progress.${progress.stage}`, {
        done: Math.min(progress.done + 1, progress.total),
        total: progress.total,
      });
    default:
      return t(`publish.progress.${progress.stage}`);
  }
}

/** A publish that went live, for *Your site is live*. */
export type LivePublish = Omit<Extract<PublishResult, { status: "published" }>, "status"> & {
  /** The publish's own name, which Open goes by: main opens only where it published. */
  readonly operationId: string;
};

/** What to tell the person about a publish that failed: what happened, and what to do. */
export function publishFailure(
  result: Extract<PublishResult, { status: "failed" }>,
  site: SiteDoc,
): string {
  switch (result.reason) {
    case "reserved-name":
      return t("publish.failed.reserved-name", { page: result.page ?? "" });
    case "unreadable-image":
      return t("publish.failed.unreadable-image", {
        image:
          result.image === undefined
            ? ""
            : (mediaItem(site.media, result.image)?.fileName ?? result.image),
      });
    default:
      return t(`publish.failed.${result.reason}`);
  }
}

/** What publishing reaches: the open site, the main process's calls and the window's dialogs. */
export type PublishFlow = {
  /** The open site, as it is now. */
  readonly site: () => SiteDoc;
  /** Ends the canvas's edit in progress, so the publish has what the person sees (A4). */
  readonly flushCanvas: () => void;
  /** Asks about the site's code its owner hasn't written here or confirmed (#649). */
  readonly confirmCode: (site: SiteDoc) => Promise<CodeDecision>;
  /** Shows the Site Check panel (3.6), where each *Must fix* has its place and, often, a *Fix*. */
  readonly showSiteCheck: () => void;
  readonly api: Pick<PublishApi, "publish" | "cancel" | "onProgress">;
  /** The opening of the site this window was loaded for (R6). */
  readonly sessionId: () => string;
  /** Whether to replace the site another publish left in the destination's folder (A8). */
  readonly askReplace: (destination: string) => Promise<boolean>;
  /** *Your site is live*. */
  readonly showLive: (live: LivePublish) => void;
  /** The site's destinations again, for one whose password must be typed again. */
  readonly showDestinations: () => void;
};

/** Publishes as operation `operationId`, telling `onProgress` each stage of it alone (A14). */
async function publishThrough(
  flow: PublishFlow,
  destinationId: string,
  operationId: string,
  replaceOtherSite: boolean,
  onProgress: (progress: PublishProgress) => void,
): Promise<PublishResult> {
  const stop = flow.api.onProgress((of, progress) => {
    if (of === operationId) onProgress(progress);
  });
  try {
    return await flow.api.publish(flow.sessionId(), destinationId, operationId, {
      replaceOtherSite,
    });
  } finally {
    stop();
  }
}

/**
 * Publishes the open site to `destination` (4.5, F-PB-2). It first asks about code the owner
 * hasn't written here or confirmed (#649); anything Site Check lists as *Must fix* for publishing
 * stops it at once, showing Site Check (X5, ADR 0016). The canvas's edit in progress ends, and
 * main has the window save before it reads the site (A4, ADR 0018 §3); the progress shows in a
 * toast whose Cancel stops it. A folder holding another site asks before it's replaced (A8). Then
 * *Your site is live*, or what went wrong and what to do.
 */
export async function publishTo(flow: PublishFlow, destination: PublishDestination): Promise<void> {
  const site = flow.site();
  try {
    const code = await flow.confirmCode(site);
    if (!code.go) return;
    const gate = {
      blocked: (count: number) => plural("siteCheck.publishBlocked", count),
      showSiteCheck: flow.showSiteCheck,
      allowListConfirmed: code.allowListConfirmed,
    };
    if (!gateOnSiteCheck(withKeptCode(flow.site(), code.keeps), "publish", gate)) return;
    let replaceOtherSite = false;
    for (;;) {
      flow.flushCanvas();
      // This publish's own name, which its progress, its Cancel and its Open go by (A14).
      const operationId = crypto.randomUUID();
      const { result, progress } = await runWithProgress<PublishProgress, PublishResult>({
        working: t("publish.run.working"),
        describe: publishProgressText,
        cancelLabel: t("publish.run.cancel"),
        cancelling: t("publish.run.cancelling"),
        cancel: () => flow.api.cancel(operationId),
        run: (onProgress) =>
          publishThrough(flow, destination.id, operationId, replaceOtherSite, onProgress),
        failed: { status: "failed", reason: "unknown" },
        failureKey: "publish",
      });
      // A toast updated in place keeps what it isn't given: the outcome drops the progress line
      // and the Cancel button.
      const fail = (message: string) =>
        toast.error(message, { id: progress, description: null, action: null });
      switch (result.status) {
        case "published": {
          toast.dismiss(progress);
          const { status: _published, ...live } = result;
          flow.showLive({ ...live, operationId });
          return;
        }
        case "cancelled":
          toast.dismiss(progress);
          return;
        case "must-fix":
          // Main's own gate found what this window's didn't: the code it trusts may differ.
          fail(plural("siteCheck.publishBlocked", result.count));
          flow.showSiteCheck();
          return;
        case "sign-in-needed":
          fail(t("publish.failed.signInNeeded"));
          flow.showDestinations();
          return;
        case "failed":
          if (result.reason === "other-site" && !replaceOtherSite) {
            toast.dismiss(progress);
            if (!(await flow.askReplace(destination.name))) return;
            replaceOtherSite = true;
            continue;
          }
          fail(publishFailure(result, site));
          return;
      }
    }
  } catch (error) {
    reportFailure("publish", error);
    toast.error(t("publish.failed.unknown"));
  }
}
