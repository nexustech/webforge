import { ErrorBoundary, ErrorFallback } from "@webforge/editor-ui";
import { t } from "@webforge/i18n";
import type { ReactNode } from "react";

/**
 * Keeps an error inside one panel (R3): the panel shows what happened in its tab, with *Reload
 * panel*, and the rest of the editor keeps working. The window's React root reports the error.
 */
export function PanelErrorBoundary({ children }: { readonly children: ReactNode }) {
  return (
    <ErrorBoundary
      fallback={(reset) => (
        <ErrorFallback
          message={t("panels.error.message")}
          actionLabel={t("panels.error.reload")}
          onAction={reset}
        />
      )}
    >
      {children}
    </ErrorBoundary>
  );
}
