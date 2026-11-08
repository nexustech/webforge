import { ErrorBoundary, ErrorFallback } from "@webforge/editor-ui";
import { t } from "@webforge/i18n";
import type { ReactNode } from "react";

/**
 * Keeps an error inside the canvas (R3): it shows what happened, with *Reload page*, and the panels
 * keep working. Both the canvas's own React root and the window's report the error.
 */
export function CanvasErrorBoundary({ children }: { readonly children: ReactNode }) {
  return (
    <ErrorBoundary
      fallback={(reset) => (
        <ErrorFallback
          message={t("canvas.error.message")}
          actionLabel={t("canvas.error.reload")}
          onAction={reset}
        />
      )}
    >
      {children}
    </ErrorBoundary>
  );
}
