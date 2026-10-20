import { t } from "@webforge/i18n";
import { useState } from "react";
import type { ExportResult } from "../../shared/ipc-contract.js";

/** Props of {@link ExportButton}. */
export type ExportButtonProps = {
  /** Exports the site; resolves with what happened (the main process shows the folder dialog). */
  readonly onExport: () => Promise<ExportResult>;
};

type Status =
  | { readonly kind: "idle" }
  | { readonly kind: "working" }
  | { readonly kind: "done"; readonly message: string };

function messageFor(result: ExportResult): string | null {
  switch (result.status) {
    case "exported":
      return t("export.done", { folder: result.folderName, files: result.files });
    case "canceled":
      return null;
    case "failed":
      return result.reason === "folder-not-empty"
        ? t("export.failed.folderNotEmpty")
        : result.reason === "write-failed"
          ? t("export.failed.writeFailed")
          : t("export.failed.buildFailed");
  }
}

/** Exports the site to a folder and says how it went, in a polite live region. */
export function ExportButton({ onExport }: ExportButtonProps) {
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const run = async () => {
    setStatus({ kind: "working" });
    let message: string | null;
    try {
      message = messageFor(await onExport());
    } catch {
      message = t("export.failed.buildFailed");
    }
    setStatus(message === null ? { kind: "idle" } : { kind: "done", message });
  };

  return (
    <div className="export">
      <button
        type="button"
        className="export__button"
        disabled={status.kind === "working"}
        onClick={() => {
          void run();
        }}
      >
        {t("export.button")}
      </button>
      <p className="export__status" aria-live="polite">
        {status.kind === "working"
          ? t("export.working")
          : status.kind === "done"
            ? status.message
            : ""}
      </p>
    </div>
  );
}
