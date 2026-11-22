import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  fieldControlClass,
} from "@webforge/editor-ui";
import { t } from "@webforge/i18n";
import { useId, useRef, useState } from "react";
import { examplesFor } from "./assistant-examples.js";

/** Props of {@link AssistantExamplesDialog}. */
export type AssistantExamplesDialogProps = {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  /** Puts `text` in the assistant's box, unsent; the dialog closes. */
  readonly onTry: (text: string) => void;
};

/**
 * *Things You Can Ask* (5.21, OL-8): example requests for the assistant by topic, found by their
 * words, each with *Try It*, which puts it in the assistant's box to change before it's sent.
 * Opened from the Assistant panel and from Help.
 */
export function AssistantExamplesDialog({
  open,
  onOpenChange,
  onTry,
}: AssistantExamplesDialogProps) {
  const [query, setQuery] = useState("");
  const searchId = useId();
  // Tried: the assistant's box takes the focus, not what opened the dialog.
  const tried = useRef(false);
  const topics = examplesFor(query);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) tried.current = false;
        onOpenChange(next);
      }}
    >
      <DialogContent
        className="flex max-h-[calc(100dvh-2rem)] flex-col sm:max-w-xl"
        onCloseAutoFocus={(event) => {
          if (tried.current) event.preventDefault();
          tried.current = false;
        }}
      >
        <DialogHeader>
          <DialogTitle>{t("assistant.examples.title")}</DialogTitle>
          <DialogDescription>{t("assistant.examples.description")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-1">
          <label htmlFor={searchId} className="text-sm font-medium">
            {t("assistant.examples.search")}
          </label>
          <input
            id={searchId}
            type="search"
            className={fieldControlClass}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        {/* A plain scroller, as the licences': the dialog keeps its height on screen. */}
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto">
          {topics.length === 0 ? (
            <p role="status" className="m-0 text-sm text-muted-foreground">
              {t("assistant.examples.none", { query: query.trim() })}
            </p>
          ) : (
            topics.map(({ topic, title, examples }) => (
              <section key={topic} aria-labelledby={`${searchId}-${topic}`}>
                <h3 id={`${searchId}-${topic}`} className="m-0 mb-1 text-sm font-semibold">
                  {title}
                </h3>
                <ul className="m-0 list-none divide-y rounded-md border p-0">
                  {examples.map(({ id, text }) => (
                    <li key={id} className="flex items-center gap-3 px-3 py-2 text-sm">
                      <span className="min-w-0 flex-1">{text}</span>
                      <Button
                        size="sm"
                        variant="outline"
                        aria-label={t("assistant.examples.tryLabel", { example: text })}
                        onClick={() => {
                          tried.current = true;
                          onTry(text);
                          onOpenChange(false);
                        }}
                      >
                        {t("assistant.examples.try")}
                      </Button>
                    </li>
                  ))}
                </ul>
              </section>
            ))
          )}
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {t("assistant.examples.close")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
