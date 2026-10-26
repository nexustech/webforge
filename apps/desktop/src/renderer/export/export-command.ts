import { toast } from "@webforge/editor-ui";
import { t } from "@webforge/i18n";
import { type SiteDoc, siteToSnapshot } from "@webforge/model";
import type { ComponentLibrary } from "@webforge/site-components";
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
    issues: result.warnings.map((warning) => {
      const page = titles.get(warning.page) ?? warning.page;
      return warning.code === "broken-link"
        ? t("export.report.brokenLink", { page })
        : t("export.report.missingImage", { page });
    }),
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
  readonly dialogs: ExportDialogs;
  /** Opens Settings on one section; `true` if the person saved (Site Settings' web address). */
  readonly showSettings: (part: string, group: string) => Promise<boolean>;
};

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
  const show = (reached: ExportProgress) => {
    if (quiet) return;
    toast.loading(t("export.working"), {
      id: progress,
      description: progressText(reached),
      action: cancelButton,
    });
  };
  try {
    const result = await flow.exportSite(exportRequestFor(site, flow.library, choices), show);
    return { result, progress };
  } catch (error) {
    reportFailure("export", error);
    return { result: { status: "failed", reason: "build-failed" }, progress };
  } finally {
    quiet = true;
  }
}

/**
 * Registers File → Export Site… (3.3). While the site has no web address it first asks to add one
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
      const last = await flow.choices();
      let askWebAddress = last.askWebAddress;
      if (askWebAddress && !hasWebAddress(flow.site())) {
        const answer = await flow.dialogs.askWebAddress();
        if (answer === "cancel") return;
        if (answer === "skip-always") askWebAddress = false;
        if (answer === "add" && !(await flow.showSettings("site", "address"))) return;
      }
      const chosen = await flow.dialogs.chooseOptions({ ...last, askWebAddress }, flow.advanced());
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
