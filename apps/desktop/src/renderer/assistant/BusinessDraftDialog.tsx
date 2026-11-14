import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  ScrollArea,
} from "@webforge/editor-ui";
import { t } from "@webforge/i18n";
import { useId, useState } from "react";
import type { BusinessText } from "./business-draft.js";
import { SiteConsent } from "./Consent.js";
import type { DraftState } from "./use-draft.js";

/** Props of {@link BusinessDraftDialog}. */
export type BusinessDraftDialogProps = {
  readonly open: boolean;
  /** The texts the draft is of, in the draft's order. */
  readonly texts: readonly BusinessText[];
  readonly state: DraftState;
  readonly onSiteAnswer: (allowed: boolean) => void;
  /** The words to keep, one for each text: empty for a text that keeps the template's. */
  readonly onUse: (words: readonly string[]) => void;
  readonly onAgain: () => void;
  readonly onCancel: () => void;
};

/**
 * The home and About pages' words the assistant drafted from the quick start's *Tell us about your
 * business* (QS-7, #873), for review: each text in a box the person can change, under where it
 * goes. Nothing changes until *Use These*; Cancel keeps the template's words. Asks this site's
 * question first if it hasn't been asked (ADR 0026 §4).
 */
export function BusinessDraftDialog(props: BusinessDraftDialogProps) {
  const { state, texts } = props;
  const id = useId();
  const drafts = state.step === "draft" ? state.texts : undefined;
  // The person's own changes, by text, until another draft comes.
  const [edited, setEdited] = useState<{
    readonly of: readonly string[];
    readonly words: Readonly<Record<number, string>>;
  } | null>(null);
  const words = texts.map((_, index) =>
    edited !== null && edited.of === drafts && edited.words[index] !== undefined
      ? edited.words[index]
      : (drafts?.[index] ?? ""),
  );
  const message =
    state.step === "denied"
      ? t("assistant.siteDenied")
      : state.step === "failed"
        ? t(`assistant.error.${state.error}`)
        : state.step === "writing"
          ? t("assistant.business.writing")
          : undefined;
  return (
    <Dialog
      open={props.open}
      onOpenChange={(next) => {
        if (!next) props.onCancel();
      }}
    >
      <DialogContent className="flex max-h-[min(44rem,calc(100dvh-2rem))] flex-col sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("assistant.business.title")}</DialogTitle>
          <DialogDescription>{t("assistant.business.about")}</DialogDescription>
        </DialogHeader>
        {state.step === "site" ? (
          <SiteConsent site={state.site} reach={state.reach} onAnswer={props.onSiteAnswer} />
        ) : drafts === undefined ? (
          <p
            role={state.step === "writing" ? "status" : "alert"}
            className="m-0 min-h-16 rounded-md border border-border p-2 text-sm"
          >
            {message}
          </p>
        ) : (
          <ScrollArea className="min-h-0 flex-1">
            <ol className="m-0 flex list-none flex-col gap-3 p-px">
              {texts.map((text, index) => (
                <li
                  key={[text.pageId, text.nodeId, text.field, text.item?.id, text.item?.field].join(
                    "/",
                  )}
                >
                  <label htmlFor={`${id}-${index}`} className="text-xs font-semibold">
                    {text.role}
                  </label>
                  <textarea
                    id={`${id}-${index}`}
                    value={words[index]}
                    rows={text.rich ? 4 : 2}
                    className="w-full resize-y rounded-sm border border-border bg-input px-2 py-1 text-sm"
                    onChange={(event) => {
                      const value = event.currentTarget.value;
                      setEdited((current) => ({
                        of: drafts,
                        words: { ...(current?.of === drafts ? current.words : {}), [index]: value },
                      }));
                    }}
                  />
                </li>
              ))}
            </ol>
          </ScrollArea>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={props.onCancel}>
            {t("assistant.business.keep")}
          </Button>
          {state.step === "draft" || state.step === "failed" ? (
            <Button variant="outline" onClick={props.onAgain}>
              {t("assistant.rewrite.again")}
            </Button>
          ) : null}
          {drafts === undefined ? null : (
            <Button onClick={() => props.onUse(words.map((word) => word.trim()))}>
              {t("assistant.business.use")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
