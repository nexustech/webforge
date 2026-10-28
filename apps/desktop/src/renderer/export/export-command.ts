import { toast } from "@webforge/editor-ui";
import { plural, t } from "@webforge/i18n";
import { DEFAULT_EXPORT_CHOICES, type SiteDoc, siteToSnapshot } from "@webforge/model";
import { blockingCount, checkSite } from "@webforge/site-check";
import type { ComponentLibrary } from "@webforge/site-components";
import { CATALOGUE } from "@webforge/site-components/catalogue-data";
import type { ExportChoices, ExportProgress } from "../../shared/ipc/site.js";
import type { ExportResult } from "../../shared/ipc-contract.js";
import type { ExportSite } from "../editor/areas.js";
import { reportFailure } from "../log.js";
import { COMMAND_IDS } from "../shell/command-ids.js";
import type { CommandRegistry } from "../shell/commands.js";
import type { ExportDialogs, ExportReport } from "./export-dialogs.js";
import { exportRequestFor } from "./export-request.js";

const EXPORT_COMMAND_ID = COMMAND_IDS.exportSite;

/** What to tell the person about an export that didn't happen; `null` when they cancelled. */
export function exportFailure(
  result: Exclude<ExportResult, { status: "exported" }>,
): string | null {
  if (result.status === "canceled") return null;
  switch (result.reason) {
    case "folder-not-empty":
      return t("export.failed.folderNotEmpty");
    case "reserved-name":
      return t("export.failed.reservedName", { page: result.page ?? "" });
    case "write-failed":
      return t("export.failed.writeFailed");
    case "too-large":
      return t("export.failed.tooLarge");
    case "build-failed":
      return t("export.failed.buildFailed");
  }
}

/** What an export has reached, under the toast's "Exporting…"; images and pages count from 1. */
export function progressText(progress: ExportProgress): string {
  switch (progress.stage) {
    case "images":
    case "pages":
      return t(`export.progress.${progress.stage}`, {
        done: Math.min(progress.done + 1, progress.total),
        total: progress.total,
      });
    default:
      return t(`export.progress.${progress.stage}`);
  }
}

/** `bytes` in kB, or MB from a megabyte, as the person's system writes them. */
export function sizeText(bytes: number): string {
  const megabytes = bytes >= 1_000_000;
  return new Intl.NumberFormat(undefined, {
    style: "unit",
    unit: megabytes ? "megabyte" : "kilobyte",
    maximumFractionDigits: megabytes ? 1 : 0,
  }).format(megabytes ? bytes / 1_000_000 : Math.max(1, Math.round(bytes / 1000)));
}

/** Whether `site` has its web address in Site Settings (X3). */
const hasWebAddress = (site: SiteDoc) => (site.settings.address.url ?? "") !== "";

/** What the report says of each kind of warning, about its page. */
const WARNING_TEXTS = {
  "broken-link": "export.report.brokenLink",
  "missing-image": "export.report.missingImage",
  "not-minified": "export.report.notMinified",
  "missing-icon": "export.report.missingIcon",
  "small-icon": "export.report.smallIcon",
  "form-unset": "export.report.formUnset",
  "custom-script": "export.report.customScript",
  "missing-kept-file": "export.report.missingKeptFile",
} as const;

/** The report of `result`, an export of `site` (07): each warning by the title of its page. */
export function exportReport(
  result: Extract<ExportResult, { status: "exported" }>,
  site: SiteDoc,
): ExportReport {
  const titles = new Map(
    siteToSnapshot(site, new Map()).pages.map((page) => [page.path, page.title]),
  );
  return {
    format: result.format,
    name: result.name,
    summary: t("export.report.summary", {
      pages: result.pages,
      files: result.files,
      size: sizeText(result.bytes),
    }),
    issues: result.warnings.map((warning) =>
      t(WARNING_TEXTS[warning.code], {
        page: titles.get(warning.page) ?? warning.page,
        // The line of custom.js's mistake, the name of a missing kept file; the other warnings'
        // texts use neither.
        line: warning.detail,
        file: warning.detail,
      }),
    ),
    more: Math.max(0, result.warningCount - result.warnings.length),
    noWebAddress: !hasWebAddress(site),
  };
}

/** What the export command reaches: the open site, the main process's calls, the dialogs. */
export type ExportFlow = {
  /** The open site, as it is now. */
  readonly site: () => SiteDoc;
  readonly library: ComponentLibrary;
  /** Advanced mode: developer files are offered (T2). */
  readonly advanced: () => boolean;
  readonly exportSite: ExportSite;
  readonly cancel: () => Promise<null>;
  /** What the person chose for this site's last export. */
  readonly choices: () => Promise<ExportChoices>;
  /** Remembers the person's choices with the site at once. */
  readonly saveChoices: (choices: ExportChoices) => Promise<null>;
  readonly dialogs: ExportDialogs;
  /** Opens Settings on one section; `true` if the person saved (Site Settings' web address). */
  readonly showSettings: (part: string, group: string) => Promise<boolean>;
  /** Shows the Site Check panel (3.6). */
  readonly showSiteCheck: () => void;
};

/**
 * Whether `site` can be exported (X5): nothing Site Check lists as *Must fix*. If something is, it
 * says how many and shows Site Check, where each has its place and, often, a *Fix*.
 */
function passesSiteCheck(flow: ExportFlow, site: SiteDoc): boolean {
  const blocking = blockingCount(checkSite({ site, catalogue: CATALOGUE }, "export"));
  if (blocking === 0) return true;
  toast.error(plural("siteCheck.exportBlocked", blocking));
  flow.showSiteCheck();
  return false;
}

/**
 * Exports `site` with `choices`, showing its progress as a toast whose Cancel button stops it
 * (3.1); the outcome comes back for the report.
 */
async function exportWithProgress(
  flow: ExportFlow,
  site: SiteDoc,
  choices: ExportChoices,
): Promise<{ readonly result: ExportResult; readonly progress: string | number }> {
  // Once it's cancelling or done, progress no longer changes the toast.
  let quiet = false;
  const cancelButton = {
    label: t("export.cancel"),
    onClick: (event: { preventDefault(): void }) => {
      // The toast stays until the export answers; it says it's stopping meanwhile.
      event.preventDefault();
      quiet = true;
      toast.loading(t("export.cancelling"), { id: progress, description: null, action: null });
      flow.cancel().catch((error: unknown) => {
        reportFailure("export.cancel", error);
      });
    },
  };
  const progress = toast.loading(t("export.working"), { action: cancelButton });
  // Simple mode doesn't offer developer files, so it writes none, while the site keeps Advanced
  // mode's choice (T2).
  const output = {
    minify: choices.minify,
    developerFiles: flow.advanced() && choices.developerFiles,
  };
  const show = (reached: ExportProgress) => {
    if (quiet) return;
    toast.loading(t("export.working"), {
      id: progress,
      description: progressText(reached),
      action: cancelButton,
    });
  };
  try {
    const request = exportRequestFor(site, flow.library, choices, output);
    const result = await flow.exportSite(request, show);
    return { result, progress };
  } catch (error) {
    reportFailure("export", error);
    return { result: { status: "failed", reason: "build-failed" }, progress };
  } finally {
    quiet = true;
  }
}

/**
 * Registers File → Export Site… (3.3). Something Site Check lists as *Must fix* stops it at once,
 * showing Site Check (3.6, X5). While the site has no web address it first asks to add one
 * (X3), unless the person said not to for this site; *Add address* opens Site Settings there and
 * goes on once they save. Then the export dialog: a folder or a ZIP, and its options, starting from
 * the site's last choices. Main asks where to write it; the export runs in a worker, with its
 * progress in a toast, so the window stays usable. The report follows, or a toast saying what went
 * wrong. The command is disabled meanwhile.
 */
export function registerExportCommand(registry: CommandRegistry, flow: ExportFlow): () => void {
  const run = async () => {
    registry.update(EXPORT_COMMAND_ID, { enabled: false });
    try {
      if (!passesSiteCheck(flow, flow.site())) return;
      // A site whose choices can't be read exports from the defaults.
      let last = await flow.choices().catch((error: unknown) => {
        reportFailure("export.choices", error);
        return DEFAULT_EXPORT_CHOICES;
      });
      if (last.askWebAddress && !hasWebAddress(flow.site())) {
        const answer = await flow.dialogs.askWebAddress();
        if (answer === "cancel") return;
        if (answer === "skip-always") {
          // Remembered now: it holds even if the export that follows is cancelled.
          last = { ...last, askWebAddress: false };
          await flow.saveChoices(last).catch((error: unknown) => {
            reportFailure("export.choices", error);
          });
        }
        if (answer === "add" && !(await flow.showSettings("site", "address"))) return;
      }
      const chosen = await flow.dialogs.chooseOptions(last, flow.advanced());
      if (chosen === undefined) return;
      // As it is now: Site Settings may have just been saved.
      const site = flow.site();
      const { result, progress } = await exportWithProgress(flow, site, chosen);
      if (result.status === "exported") {
        toast.dismiss(progress);
        flow.dialogs.showReport(exportReport(result, site));
        return;
      }
      const failure = exportFailure(result);
      // A toast updated in place keeps what it isn't given: the outcome drops the progress line
      // and the Cancel button.
      if (failure === null) toast.dismiss(progress);
      else toast.error(failure, { id: progress, description: null, action: null });
    } catch (error) {
      reportFailure("export", error);
      toast.error(t("export.failed.buildFailed"));
    } finally {
      registry.update(EXPORT_COMMAND_ID, { enabled: true });
    }
  };
  return registry.register({
    id: EXPORT_COMMAND_ID,
    label: t("command.exportSite"),
    menu: "file",
    run,
  });
}
