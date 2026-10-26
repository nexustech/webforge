import { toast } from "@webforge/editor-ui";
import { t } from "@webforge/i18n";
import type { ExportProgress } from "../../shared/ipc/site.js";
import type { ExportResult } from "../../shared/ipc-contract.js";
import { reportFailure } from "../log.js";
import { COMMAND_IDS } from "../shell/command-ids.js";
import type { CommandRegistry } from "../shell/commands.js";

const EXPORT_COMMAND_ID = COMMAND_IDS.exportSite;

/** What to tell the user about an export; `null` when they cancelled. */
export function exportMessage(
  result: ExportResult,
): { readonly kind: "success" | "error"; readonly text: string } | null {
  switch (result.status) {
    case "exported":
      return {
        kind: "success",
        text: t("export.done", { folder: result.folderName, files: result.files }),
      };
    case "canceled":
      return null;
    case "failed":
      return {
        kind: "error",
        text:
          result.reason === "folder-not-empty"
            ? t("export.failed.folderNotEmpty")
            : result.reason === "reserved-name"
              ? t("export.failed.reservedName", { page: result.page ?? "" })
              : result.reason === "write-failed"
                ? t("export.failed.writeFailed")
                : t("export.failed.buildFailed"),
      };
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

/**
 * Registers File → Export Site…: asks main for a folder and exports there (`onExport`), showing
 * its progress and the outcome as a toast, whose Cancel button stops it (`cancel`, 3.1). The
 * export runs in a worker, so the window stays usable meanwhile; the command is disabled while
 * one runs.
 */
export function registerExportCommand(
  registry: CommandRegistry,
  onExport: (onProgress: (progress: ExportProgress) => void) => Promise<ExportResult>,
  cancel: () => Promise<null>,
): () => void {
  const run = async () => {
    registry.update(EXPORT_COMMAND_ID, { enabled: false });
    const progress = toast.loading(t("export.working"));
    let cancelling = false;
    const show = (description: string | undefined) => {
      if (cancelling) return;
      toast.loading(t("export.working"), {
        id: progress,
        description,
        action: {
          label: t("export.cancel"),
          onClick: (event) => {
            // The toast stays until the export answers; it says it's stopping meanwhile.
            event.preventDefault();
            toast.loading(t("export.cancelling"), { id: progress, description: undefined });
            cancelling = true;
            cancel().catch((error: unknown) => {
              reportFailure("export.cancel", error);
            });
          },
        },
      });
    };
    show(undefined);
    let message: ReturnType<typeof exportMessage>;
    try {
      message = exportMessage(await onExport((reached) => show(progressText(reached))));
    } catch (error) {
      reportFailure("export", error);
      message = { kind: "error", text: t("export.failed.buildFailed") };
    } finally {
      registry.update(EXPORT_COMMAND_ID, { enabled: true });
    }
    if (message === null) {
      toast.dismiss(progress);
    } else if (message.kind === "success") {
      toast.success(message.text, { id: progress });
    } else {
      toast.error(message.text, { id: progress });
    }
  };
  return registry.register({
    id: EXPORT_COMMAND_ID,
    label: t("command.exportSite"),
    menu: "file",
    run,
  });
}
