import { Button } from "@webforge/editor-ui";
import { plural, t } from "@webforge/i18n";
import { useId } from "react";
import type { ReplyUndo } from "./reply-undo.js";

/** A change of the reply: one undo step (ADR 0026 §7's `ReplyStep`). */
type ReviewStep = {
  readonly entryId: string;
  readonly label: string;
  /** Where it changed the site; none for a site-wide change. */
  readonly target?: { readonly pageId: string; readonly nodeId?: string | undefined } | undefined;
};

/** Props of {@link ReviewCard}. */
export type ReviewCardProps = {
  readonly steps: readonly ReviewStep[];
  /** Links to other websites the reply added or changed, by host as a browser reads it (S18). */
  readonly links: readonly { readonly host: string; readonly href: string }[];
  /** Held changes it couldn't make when they were applied, as the site had changed (6.9e). */
  readonly refused?: readonly { readonly label: string }[] | undefined;
  /** What *Undo these changes* can do now ({@link replyUndo}). */
  readonly undo: ReplyUndo;
  /** Closes the card, keeping the changes. */
  readonly onKeep: () => void;
  /** Undoes the reply's steps, as one undo. */
  readonly onUndo: () => void;
  /** Opens Version History at the version saved before the assistant's changes. */
  readonly onOpenVersions: () => void;
  /** Selects and shows a change on the canvas. */
  readonly onShowStep: (step: ReviewStep) => void;
};

/** The "AI (Assistant): " every step's label starts with, which the card needn't repeat. */
const LABEL_PREFIX = /^AI \([^)]*\): /;

/**
 * The review card after a reply that changed the site (AIA-5, WF-2, ADR 0026 §7): each change, which
 * shows on the canvas when chosen, and each link to another website by its host, so a look-alike
 * shows. *Keep* closes it; *Undo these changes* takes back exactly this reply's changes, as one
 * undo, while nothing has happened since. After that, only the version saved before the
 * assistant's changes can, in Version History.
 */
export function ReviewCard({
  steps,
  links,
  refused = [],
  undo,
  onKeep,
  onUndo,
  onOpenVersions,
  onShowStep,
}: ReviewCardProps) {
  const id = useId();
  return (
    <section
      aria-labelledby={`${id}-title`}
      className="flex flex-col gap-2 rounded-md border border-border bg-muted/40 p-2 text-xs"
    >
      <h3 id={`${id}-title`} className="m-0 text-xs font-semibold">
        {plural("assistant.review.title", steps.length)}
      </h3>
      <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
        {steps.map((step, index) => {
          const label = step.label.replace(LABEL_PREFIX, "");
          return (
            // Two steps can share an entry, merged into one Undo History step.
            <li key={`${index}:${step.entryId}`}>
              {step.target === undefined ? (
                <span className="px-1">{label}</span>
              ) : (
                <button
                  type="button"
                  title={t("assistant.review.show", { change: label })}
                  className="rounded-sm px-1 text-left underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-ring"
                  onClick={() => onShowStep(step)}
                >
                  {label}
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {refused.length === 0 ? null : (
        <div>
          <p className="m-0 text-muted-foreground">
            {plural("assistant.review.refused", refused.length)}
          </p>
          <ul className="m-0 list-none p-0 text-muted-foreground">
            {refused.map((change, index) => (
              <li key={`${index}:${change.label}`} className="px-1">
                {change.label.replace(LABEL_PREFIX, "")}
              </li>
            ))}
          </ul>
        </div>
      )}
      {links.length === 0 ? null : (
        <div>
          <h4 className="m-0 text-xs font-semibold">{t("assistant.review.links")}</h4>
          <ul className="m-0 list-none p-0">
            {links.map((link) => (
              <li key={link.href} className="px-1 [overflow-wrap:anywhere]">
                <strong className="font-semibold">{link.host}</strong>{" "}
                <span className="text-muted-foreground">{link.href}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {undo.kind === "undone" ? (
        <p role="status" className="m-0 text-muted-foreground">
          {t("assistant.review.undone")}
        </p>
      ) : undo.kind === "moved-on" ? (
        <>
          <p className="m-0 text-muted-foreground">{t("assistant.review.movedOn")}</p>
          <div className="flex flex-wrap justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={onKeep}>
              {t("assistant.review.keep")}
            </Button>
            <Button size="sm" variant="outline" onClick={onOpenVersions}>
              {t("assistant.review.versions")}
            </Button>
          </div>
        </>
      ) : (
        <div className="flex flex-wrap justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={onUndo}>
            {t("assistant.review.undo")}
          </Button>
          <Button size="sm" onClick={onKeep}>
            {t("assistant.review.keep")}
          </Button>
        </div>
      )}
    </section>
  );
}
