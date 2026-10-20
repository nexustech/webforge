import { toast } from "@webforge/editor-ui";
import { t } from "@webforge/i18n";
import type { ExportResult } from "../../shared/ipc-contract.js";
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
            : result.reason === "write-failed"
              ? t("export.failed.writeFailed")
              : t("export.failed.buildFailed"),
      };
  }
}

/**
 * Registers File → Export Site…: asks main for a folder and exports there (`onExport`), showing
 * progress and the outcome as a toast. The command is disabled while an export runs.
 */
export function registerExportCommand(
  registry: CommandRegistry,
  onExport: () => Promise<ExportResult>,
): () => void {
  const run = async () => {
    registry.update(EXPORT_COMMAND_ID, { enabled: false });
    const progress = toast.loading(t("export.working"));
    let message: ReturnType<typeof exportMessage>;
    try {
      message = exportMessage(await onExport());
    } catch {
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
    shortcut: "Mod+E",
    run,
  });
}
