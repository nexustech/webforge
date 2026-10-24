import { t } from "@webforge/i18n";
import type { ReactNode } from "react";

/**
 * The row under the canvas toolbar for the selected element's own toolbar (SP-4, amended 24 Oct
 * 2026): a Heading's level, a List's *Add item*, the Columns' layout. Always there, empty when the
 * selection has no toolbar, so selecting never moves the canvas. Next in the Tab order after the
 * canvas toolbar.
 */
export function ElementToolbarRow({ children }: { readonly children?: ReactNode }) {
  return (
    <div
      role="toolbar"
      aria-label={t("elementToolbar.label")}
      // Text in the toolbar's own colour, as in the canvas toolbar above.
      className="flex h-8 shrink-0 items-center justify-center border-b border-border-strong bg-toolbar px-2 text-foreground"
    >
      {children}
    </div>
  );
}
