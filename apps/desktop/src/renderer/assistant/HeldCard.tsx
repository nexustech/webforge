import { Button } from "@webforge/editor-ui";
import { plural, t } from "@webforge/i18n";
import { useId } from "react";

/** A change the reply holds: what it would do, and where (ADR 0026 §7's `HeldChange`). */
type Held = { readonly label: string };

/** What became of held changes that aren't waiting any more. */
export type HeldOutcome = "discarded" | "replaced";

/** Props of {@link HeldCard}. */
export type HeldCardProps = {
  /** The changes waiting; none once they're settled. */
  readonly held: readonly Held[];
  /** Links to other websites the changes would add or change, by host (S18). */
  readonly links: readonly { readonly host: string; readonly href: string }[];
  /** Why none are waiting: discarded by the person, or dropped for a newer reply's. */
  readonly outcome?: HeldOutcome | undefined;
  /** _Apply_ is under way. */
  readonly applying: boolean;
  readonly onApply: () => void;
  readonly onDiscard: () => void;
};

/** The "AI (Assistant): " every change's label starts with, which the card needn't repeat. */
const LABEL_PREFIX = /^AI \([^)]*\): /;

/**
 * The card after a reply whose changes are held (6.9e, AIA-5's _Review before applying_): what it
 * would change, and each link to another website by its host, so a look-alike shows. Nothing in
 * the site has changed yet. _Apply_ makes them, each an undo step; _Discard_ drops them.
 */
export function HeldCard({ held, links, outcome, applying, onApply, onDiscard }: HeldCardProps) {
  const id = useId();
  if (outcome !== undefined) {
    return (
      <p
        role="status"
        className="m-0 rounded-md border border-border p-2 text-xs text-muted-foreground"
      >
        {t(outcome === "discarded" ? "assistant.held.discarded" : "assistant.held.replaced")}
      </p>
    );
  }
  return (
    <section
      aria-labelledby={`${id}-title`}
      className="flex flex-col gap-2 rounded-md border border-border bg-muted/40 p-2 text-xs"
    >
      <h3 id={`${id}-title`} className="m-0 text-xs font-semibold">
        {plural("assistant.held.title", held.length)}
      </h3>
      <p className="m-0 text-muted-foreground">{t("assistant.held.description")}</p>
      <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
        {held.map((change, index) => (
          // Two changes can read the same.
          <li key={`${index}:${change.label}`} className="px-1">
            {change.label.replace(LABEL_PREFIX, "")}
          </li>
        ))}
      </ul>
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
      <div className="flex flex-wrap justify-end gap-2">
        <Button size="sm" variant="ghost" disabled={applying} onClick={onDiscard}>
          {t("assistant.held.discard")}
        </Button>
        <Button size="sm" disabled={applying} onClick={onApply}>
          {applying ? t("assistant.held.applying") : t("assistant.held.apply")}
        </Button>
      </div>
    </section>
  );
}
