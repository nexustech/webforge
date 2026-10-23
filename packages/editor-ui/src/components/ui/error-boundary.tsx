import { TriangleAlertIcon } from "lucide-react";
import { Component, type ReactNode } from "react";
import { Button } from "./button.js";

/** Props of {@link ErrorBoundary}. */
export type ErrorBoundaryProps = {
  readonly children: ReactNode;
  /** Shown instead of `children` once they throw while rendering; `reset` tries them again. */
  readonly fallback: (reset: () => void) => ReactNode;
};

type ErrorBoundaryState = { readonly failed: boolean };

/**
 * Keeps an error inside one part of the editor (R3): when `children` throw while rendering, it
 * shows `fallback` in their place and the rest of the window keeps working. It only catches; the
 * React root's `onCaughtError` reports the error. React has no hook for this, so it is the editor's
 * one class component.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { failed: true };
  }

  private readonly reset = () => this.setState({ failed: false });

  override render(): ReactNode {
    return this.state.failed ? this.props.fallback(this.reset) : this.props.children;
  }
}

/** Props of {@link ErrorFallback}. */
export type ErrorFallbackProps = {
  /** What went wrong, and that the work is safe. */
  readonly message: string;
  /** The button that tries again, such as "Reload panel". */
  readonly actionLabel: string;
  readonly onAction: () => void;
};

/** What a part of the editor shows instead of itself after an error ({@link ErrorBoundary}). */
export function ErrorFallback({ message, actionLabel, onAction }: ErrorFallbackProps) {
  return (
    <div
      role="alert"
      className="flex h-full flex-col items-center justify-center gap-3 bg-panel p-4 text-center text-xs text-muted-foreground"
    >
      <TriangleAlertIcon aria-hidden className="size-5 text-warning" />
      <p className="max-w-64">{message}</p>
      <Button size="sm" variant="outline" onClick={onAction}>
        {actionLabel}
      </Button>
    </div>
  );
}
