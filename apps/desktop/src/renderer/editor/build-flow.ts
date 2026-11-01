import { toast } from "@webforge/editor-ui";
import type { SiteDoc } from "@webforge/model";
import { blockingCount, type CheckMode, checkSite } from "@webforge/site-check";
import { CATALOGUE } from "@webforge/site-components/catalogue-data";
import { reportFailure } from "../log.js";

/**
 * The steps every build of the site shares, for Export (3.1, 3.3), Publish (4.5) and Republish
 * (4.6) to compose (#668, architecture review 2 A17): Site Check's gate, then the build with its
 * progress in a toast that can cancel it.
 */

/** What {@link gateOnSiteCheck} tells the person, and where it sends them. */
type GateOptions = {
  /** The toast for `count` things to fix first: "Fix 2 things in Site Check before exporting". */
  readonly blocked: (count: number) => string;
  /** Shows the Site Check panel, where each finding has its place and, often, a *Fix*. */
  readonly showSiteCheck: () => void;
};

/**
 * Whether `site` can be built in `mode` (X5): nothing Site Check lists as *Must fix* there. If
 * something is, it says how many and shows Site Check. Publishing's rules are the stricter
 * (ADR 0016); main checks again before it publishes (ADR 0018 §4).
 */
export function gateOnSiteCheck(site: SiteDoc, mode: CheckMode, options: GateOptions): boolean {
  const blocking = blockingCount(checkSite({ site, catalogue: CATALOGUE }, mode));
  if (blocking === 0) return true;
  toast.error(options.blocked(blocking));
  options.showSiteCheck();
  return false;
}

/** What {@link runWithProgress} shows and does. */
type ProgressOptions<Progress, Result> = {
  /** The toast's title while it runs: "Exporting…". */
  readonly working: string;
  /** The line under it for each stage reached: "Converting images (3 of 12)". */
  readonly describe: (progress: Progress) => string;
  /** The Cancel button's label. */
  readonly cancelLabel: string;
  /** The toast's title once Cancel is pressed, until the work answers: "Stopping…". */
  readonly cancelling: string;
  /** Asks the work to stop; it still answers, with its own outcome. */
  readonly cancel: () => Promise<unknown>;
  /** Runs the work, telling `onProgress` each stage it reaches. */
  readonly run: (onProgress: (progress: Progress) => void) => Promise<Result>;
  /** The outcome when `run` throws, which is reported under `failureKey`. */
  readonly failed: Result;
  readonly failureKey: string;
};

/**
 * Runs a build with its progress as a loading toast whose Cancel button stops it (3.1): pressed,
 * the toast says it's stopping until the work answers, and later progress leaves it be. The
 * outcome comes back with the toast's id, for the caller to replace or dismiss.
 */
export async function runWithProgress<Progress, Result>(
  options: ProgressOptions<Progress, Result>,
): Promise<{ readonly result: Result; readonly progress: string | number }> {
  // Once it's cancelling or done, progress no longer changes the toast.
  let quiet = false;
  const cancelButton = {
    label: options.cancelLabel,
    onClick: (event: { preventDefault(): void }) => {
      // The toast stays until the work answers; it says it's stopping meanwhile.
      event.preventDefault();
      quiet = true;
      toast.loading(options.cancelling, { id: progress, description: null, action: null });
      options.cancel().catch((error: unknown) => {
        reportFailure(`${options.failureKey}.cancel`, error);
      });
    },
  };
  const progress = toast.loading(options.working, { action: cancelButton });
  const show = (reached: Progress) => {
    if (quiet) return;
    toast.loading(options.working, {
      id: progress,
      description: options.describe(reached),
      action: cancelButton,
    });
  };
  try {
    return { result: await options.run(show), progress };
  } catch (error) {
    reportFailure(options.failureKey, error);
    return { result: options.failed, progress };
  } finally {
    quiet = true;
  }
}
