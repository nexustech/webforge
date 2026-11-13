import { cn } from "@webforge/editor-ui";
import { t } from "@webforge/i18n";
import { money } from "./money.js";

/** This month's spend and limit, as ADR 0026 §7's `AssistantStatus.month` has them. */
export type MonthView = {
  readonly spentUsd: number;
  readonly limitUsd: number;
  /** Over 80% of the limit (AIA-8). */
  readonly warned: boolean;
  readonly reached: boolean;
};

/**
 * This month's spend against its limit, in the panel's header (AIA-8): in money, as OpenRouter
 * bills, marked once it passes 80% and when the limit is reached.
 */
export function MonthReadout({ month }: { readonly month: MonthView }) {
  const spent = money(month.spentUsd);
  const limit = money(month.limitUsd);
  const share = month.limitUsd > 0 ? Math.min(1, month.spentUsd / month.limitUsd) : 1;
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <p
        className={cn(
          "m-0 text-xs",
          month.reached
            ? "text-destructive-text"
            : month.warned
              ? "text-warning"
              : "text-muted-foreground",
        )}
      >
        {month.reached
          ? t("assistant.month.reached", { limit })
          : t(month.warned ? "assistant.month.warning" : "assistant.month", { spent, limit })}
      </p>
      <div aria-hidden className="h-1 overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full rounded-full",
            month.reached ? "bg-destructive" : month.warned ? "bg-warning" : "bg-ring",
          )}
          style={{ width: `${Math.round(share * 100)}%` }}
        />
      </div>
    </div>
  );
}
