import { Button } from "@webforge/editor-ui";
import { t } from "@webforge/i18n";
import { useId } from "react";

/** Props of {@link SuggestedNext}. */
export type SuggestedNextProps = {
  /** Two or three short requests, as the assistant wrote them: plain text. */
  readonly suggestions: readonly string[];
  /** A message is on its way: the suggestions wait. */
  readonly busy: boolean;
  /** Sends `suggestion` as the person's next message. */
  readonly onSend: (suggestion: string) => void;
};

/**
 * What the person might ask next (5.17, OL-2), under the review card of a reply that changed the
 * site: each a button that sends it as their next message, for people who don't know what to ask
 * for. Shown as plain text, never as Markdown or HTML.
 */
export function SuggestedNext({ suggestions, busy, onSend }: SuggestedNextProps) {
  const id = useId();
  if (suggestions.length === 0) return null;
  return (
    <section aria-labelledby={id} className="flex flex-col gap-1.5">
      <h3 id={id} className="m-0 text-xs font-semibold text-muted-foreground">
        {t("assistant.suggestions.title")}
      </h3>
      <ul className="m-0 flex list-none flex-col gap-1 p-0">
        {suggestions.map((suggestion) => (
          <li key={suggestion}>
            <Button
              size="sm"
              variant="outline"
              className="h-auto min-h-7 w-full justify-start whitespace-normal py-1 text-left"
              aria-label={t("assistant.suggestions.send", { suggestion })}
              disabled={busy}
              onClick={() => onSend(suggestion)}
            >
              <span className="[overflow-wrap:anywhere]">{suggestion}</span>
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
