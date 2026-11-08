import { Button, cn } from "@webforge/editor-ui";
import { t } from "@webforge/i18n";
import type { ReactNode } from "react";

/** A starting point to choose (Blank, or a template): a radio drawn as a card. */
export function StartingPointCard({
  name,
  checked,
  onChoose,
  preview,
  title,
  subtitle,
  details,
}: {
  readonly name: string;
  readonly checked: boolean;
  readonly onChoose: () => void;
  readonly preview: ReactNode;
  readonly title: string;
  readonly subtitle: string;
  /** Opens the larger preview; none for Blank. */
  readonly details?: () => void;
}) {
  return (
    <div
      className={cn(
        "relative flex flex-col overflow-hidden rounded-md border border-border bg-card",
        "hover:border-border-strong has-[:checked]:border-primary has-[:checked]:ring-1 has-[:checked]:ring-primary",
        "has-[input:focus-visible]:ring-2 has-[input:focus-visible]:ring-ring",
      )}
    >
      <label className="flex cursor-pointer flex-col">
        <input type="radio" name={name} checked={checked} onChange={onChoose} className="sr-only" />
        <span className="flex aspect-video w-full items-center justify-center bg-muted">
          {preview}
        </span>
        <span className={cn("flex flex-col gap-0.5 p-2", details !== undefined && "pr-20")}>
          <span className="truncate text-sm font-medium">{title}</span>
          <span className="line-clamp-2 text-xs text-muted-foreground">{subtitle}</span>
        </span>
      </label>
      {details === undefined ? null : (
        // Outside the label, so it opens the preview without choosing the card.
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="absolute right-1 bottom-2"
          aria-label={t("newSite.detailsOf", { name: title })}
          onClick={details}
        >
          {t("newSite.details")}
        </Button>
      )}
    </div>
  );
}
