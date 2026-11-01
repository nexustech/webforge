import { toast } from "@webforge/editor-ui";
import { plural, t } from "@webforge/i18n";
import {
  DEFAULT_EXPORT_CHOICES,
  mediaItem,
  type SiteDoc,
  siteToSnapshot,
  withKeptCode,
} from "@webforge/model";
import type { ComponentLibrary } from "@webforge/site-components";
import type { ExportChoices, ExportProgress, ExportRequest } from "../../shared/ipc/site.js";
import type { ExportResult } from "../../shared/ipc-contract.js";
import { gateOnSiteCheck, runWithProgress } from "../editor/build-flow.js";
import type { CodeDecision } from "../editor/code-trust.js";
import { reportFailure } from "../log.js";
import { COMMAND_IDS } from "../shell/command-ids.js";
import type { CommandRegistry } from "../shell/commands.js";
import type { ExportDialogs, ExportReport } from "./export-dialogs.js";
import { exportRequestFor } from "./export-request.js";

const EXPORT_COMMAND_ID = COMMAND_IDS.exportSite;

/**
 * What to tell the person about an export of `site` that didn't happen; `null` when they
 * cancelled. An image is named as the Media panel shows it.
 */
export function exportFailure(
  result: Exclude<ExportResult, { status: "exported" }>,
  site: SiteDoc,
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
    case "unreadable-image":
      return t("export.failed.unreadableImage", {
        image: imageFileName(result.image, site),
      });
  }
}

/** The file name Media shows for image `id`, or the id itself if the image has gone. */
function imageFileName(id: string | undefined, site: SiteDoc): string {
  if (id === undefined) return "";
  return mediaItem(site.media, id)?.fileName ?? id;
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

/** Exports a site as operation `operationId`, telling `onProgress` how far it has come (3.1). */
export type ExportSite = (
  request: ExportRequest,
  operationId: string,
  onProgress: (progress: ExportProgress) => void,
) => Promise<ExportResult>;

/** What the export command reaches: the open site, the main process's calls, the dialogs. */
export type ExportFlow = {
  /** The open site, as it is now. */
  readonly site: () => SiteDoc;
  readonly library: ComponentLibrary;
  /** Advanced mode: developer files are offered (T2). */
  readonly advanced: () => boolean;
  readonly exportSite: ExportSite;
  /** Cancels export `operationId`, and no other (A14). */
  readonly cancel: (operationId: string) => Promise<null>;
  /** What the person chose for this site's last export. */
  readonly choices: () => Promise<ExportChoices>;
  /** Remembers the person's choices with the site at once. */
  readonly saveChoices: (choices: ExportChoices) => Promise<null>;
  readonly dialogs: ExportDialogs;
  /** Opens Settings on one section; `true` if the person saved (Site Settings' web address). */
  readonly showSettings: (part: string, group: string) => Promise<boolean>;
  /** Shows the Site Check panel (3.6). */
  readonly showSiteCheck: () => void;
  /** Asks about the site's code its owner hasn't written here or confirmed (#649). */
  readonly confirmCode: (site: SiteDoc) => Promise<CodeDecision>;
};

/**
 * Exports `site` with `choices`, showing its progress as a toast whose Cancel button stops it
 * (3.1, `runWithProgress`); the outcome comes back for the report.
 */
function exportWithProgress(
  flow: ExportFlow,
  site: SiteDoc,
  choices: ExportChoices,
): Promise<{ readonly result: ExportResult; readonly progress: string | number }> {
  // Simple mode doesn't offer developer files, so it writes none, while the site keeps Advanced
  // mode's choice (T2).
  const output = {
    minify: choices.minify,
    developerFiles: flow.advanced() && choices.developerFiles,
  };
  // This export's own name, which its progress and its Cancel button go by (A14).
  const operationId = crypto.randomUUID();
  return runWithProgress<ExportProgress, ExportResult>({
    working: t("export.working"),
    describe: progressText,
    cancelLabel: t("export.cancel"),
    cancelling: t("export.cancelling"),
    cancel: () => flow.cancel(operationId),
    run: (onProgress) =>
      flow.exportSite(
        exportRequestFor(site, flow.library, choices, output),
        operationId,
        onProgress,
      ),
    failed: { status: "failed", reason: "build-failed" },
    failureKey: "export",
  });
}

/**
 * Registers File → Export Site… (3.3). It first asks about code the owner hasn't written here or
 * confirmed (#649). Something Site Check lists as *Must fix* stops it at once,
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
      // Code from someone else's file first (#649): what the owner leaves out isn't checked, as
      // it won't be exported, and the allowed addresses count once they're confirmed.
      const code = await flow.confirmCode(flow.site());
      if (!code.go) return;
      const gate = {
        blocked: (count: number) => plural("siteCheck.exportBlocked", count),
        showSiteCheck: flow.showSiteCheck,
        allowListConfirmed: code.allowListConfirmed,
      };
      if (!gateOnSiteCheck(withKeptCode(flow.site(), code.keeps), "export", gate)) return;
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
      const failure = exportFailure(result, site);
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
