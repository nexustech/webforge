import { WithTooltip } from "@webforge/editor-ui";
import { t } from "@webforge/i18n";
import { CheckIcon } from "lucide-react";
import { useStore } from "zustand";
import type { StoreApi } from "zustand/vanilla";
import type { SaveStatus as Status } from "./autosave.js";

/** Props of {@link SaveStatus}. */
export type SaveStatusProps = {
  readonly status: StoreApi<{ readonly status: Status }>;
};

/**
 * "Saved" or "Saving…" in the title bar (P2), instead of an unsaved-changes dot: a change waiting
 * for its save already counts as saving. A failed save says so; the next change tries again. While
 * the title bar is narrow (#1195), "Saved" is its tick, its words in its tooltip and still read out;
 * saving and a failed save keep their words, which are what someone needs to see then.
 */
export function SaveStatus({ status }: SaveStatusProps) {
  const current = useStore(status, (state) => state.status);
  const label =
    current === "saved"
      ? t("storage.saved")
      : current === "error"
        ? t("storage.saveFailed")
        : t("storage.saving");
  const saved = current === "saved";
  return (
    <WithTooltip tooltip={label}>
      <p
        className="m-0 flex items-center text-sm text-muted-foreground"
        role="status"
        data-status={current}
      >
        {/* Written out in full: Tailwind finds its classes in the source as they are. */}
        {saved ? <CheckIcon aria-hidden className="size-4 @min-[960px]/title-bar:hidden" /> : null}
        <span className={saved ? "sr-only @min-[960px]/title-bar:not-sr-only" : undefined}>
          {label}
        </span>
      </p>
    </WithTooltip>
  );
}
