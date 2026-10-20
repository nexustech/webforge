import { t } from "@webforge/i18n";
import { useStore } from "zustand";
import type { StoreApi } from "zustand/vanilla";
import type { SaveStatus as Status } from "./autosave.js";

/** Props of {@link SaveStatus}. */
export type SaveStatusProps = {
  readonly status: StoreApi<{ readonly status: Status }>;
};

/**
 * "Saved" or "Saving…" in the title bar (P2), instead of an unsaved-changes dot: a change waiting
 * for its save already counts as saving. A failed save says so; the next change tries again.
 */
export function SaveStatus({ status }: SaveStatusProps) {
  const current = useStore(status, (state) => state.status);
  const label =
    current === "saved"
      ? t("storage.saved")
      : current === "error"
        ? t("storage.saveFailed")
        : t("storage.saving");
  return (
    <p className="app__save-status" role="status" data-status={current}>
      {label}
    </p>
  );
}
