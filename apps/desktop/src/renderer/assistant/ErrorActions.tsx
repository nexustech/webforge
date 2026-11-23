import { Button } from "@webforge/editor-ui";
import { t } from "@webforge/i18n";
import type { ErrorAction } from "./error-actions.js";

/** Props of {@link ErrorActions}. */
export type ErrorActionsProps = {
  /** The error's actions ({@link errorActions}), in order. */
  readonly actions: readonly ErrorAction[];
  /** Sends the message again; without it, no Try Again (a reply under way, or an older one). */
  readonly onRetry?: (() => void) | undefined;
  readonly onSettings: () => void;
  readonly onCredits: () => void;
};

/**
 * What the person can do about an error of the assistant's (5.20, OL-5), under its message: Try
 * Again, *Assistant Settings…*, *Add Credit on OpenRouter*. Nothing where there's nothing to do.
 */
export function ErrorActions({ actions, onRetry, onSettings, onCredits }: ErrorActionsProps) {
  const shown = actions.filter((action) => action !== "retry" || onRetry !== undefined);
  if (shown.length === 0) return null;
  const handlers: Readonly<Record<ErrorAction, (() => void) | undefined>> = {
    retry: onRetry,
    settings: onSettings,
    credits: onCredits,
  };
  return (
    <div className="flex flex-wrap gap-2">
      {shown.map((action, index) => (
        <Button
          key={action}
          size="sm"
          variant={index === 0 ? "outline" : "ghost"}
          onClick={handlers[action]}
        >
          {t(`assistant.error.action.${action}`)}
        </Button>
      ))}
    </div>
  );
}
