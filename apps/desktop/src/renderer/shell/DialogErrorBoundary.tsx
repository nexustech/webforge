import {
  Dialog,
  DialogContent,
  DialogTitle,
  ErrorBoundary,
  ErrorFallback,
} from "@webforge/editor-ui";
import { t } from "@webforge/i18n";
import type { ReactNode } from "react";

/**
 * Keeps an error inside one window dialog (#1320), as a panel's is kept in the panel (R3): the
 * dialog's place shows what happened, and the editor behind it keeps working. Closing it, with its
 * button or Escape, closes the dialog through `close`, so it can be opened again, and draws it anew.
 * The window's React root reports the error, as it does any an error boundary catches.
 */
export function DialogErrorBoundary({
  children,
  close,
}: {
  readonly children: ReactNode;
  /** Closes the dialog in its area's state; without it, closing draws it again as it is. */
  readonly close?: (() => void) | undefined;
}) {
  return (
    <ErrorBoundary
      fallback={(reset) => {
        const closed = () => {
          close?.();
          reset();
        };
        return (
          <Dialog
            open
            onOpenChange={(open) => {
              if (!open) closed();
            }}
          >
            <DialogContent
              aria-describedby={undefined}
              showClose={false}
              className="h-auto min-h-48 max-w-sm"
            >
              <DialogTitle className="sr-only">{t("panels.dialogError.title")}</DialogTitle>
              <ErrorFallback
                message={t("panels.dialogError.message")}
                actionLabel={t("panels.dialogError.close")}
                onAction={closed}
              />
            </DialogContent>
          </Dialog>
        );
      }}
    >
      {children}
    </ErrorBoundary>
  );
}
