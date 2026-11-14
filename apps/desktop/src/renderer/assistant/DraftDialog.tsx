import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@webforge/editor-ui";
import { t } from "@webforge/i18n";
import { type ReactNode, useId, useState } from "react";
import { SiteConsent } from "./Consent.js";
import type { DraftState } from "./use-draft.js";

/** Props of {@link DraftDialog}. */
export type DraftDialogProps = {
  readonly open: boolean;
  readonly title: string;
  /** What the draft is of: "A description of Menu, for search results and shares." */
  readonly description: string;
  /** The text box's name: "Description". */
  readonly label: string;
  /** The most the text may be. */
  readonly maxLength: number;
  readonly state: DraftState;
  /** Shows the text as it would be used, under the text box: SEO-6's search result, say. */
  readonly preview?: (text: string) => ReactNode;
  readonly onSiteAnswer: (allowed: boolean) => void;
  readonly onUse: (text: string) => void;
  readonly onAgain: () => void;
  readonly onCancel: () => void;
};

/**
 * A short text the assistant drafted (#873, G25b), for review: a page's description or an image's
 * alt text, in a text box the person can change, with how it would look. Nothing changes until
 * *Use This*. Asks this site's question first if it hasn't been asked (ADR 0026 §4).
 */
export function DraftDialog(props: DraftDialogProps) {
  const { state } = props;
  const id = useId();
  const draft = state.step === "draft" ? (state.texts[0] ?? "") : undefined;
  // The person's own changes to the draft, until another draft comes.
  const [edited, setEdited] = useState<{ readonly of: string; readonly text: string } | null>(null);
  const text = draft === undefined ? "" : edited?.of === draft ? edited.text : draft;
  const message =
    state.step === "denied"
      ? t("assistant.siteDenied")
      : state.step === "failed"
        ? t(`assistant.error.${state.error}`)
        : state.step === "writing"
          ? t("assistant.rewrite.writing")
          : undefined;
  return (
    <Dialog
      open={props.open}
      onOpenChange={(next) => {
        if (!next) props.onCancel();
      }}
    >
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{props.title}</DialogTitle>
          <DialogDescription>{props.description}</DialogDescription>
        </DialogHeader>
        {state.step === "site" ? (
          <SiteConsent site={state.site} reach={state.reach} onAnswer={props.onSiteAnswer} />
        ) : draft === undefined ? (
          <p
            role={state.step === "writing" ? "status" : "alert"}
            className="m-0 min-h-16 rounded-md border border-border p-2 text-sm"
          >
            {message}
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            <label htmlFor={`${id}-text`} className="text-xs font-semibold">
              {props.label}
            </label>
            <textarea
              id={`${id}-text`}
              value={text}
              maxLength={props.maxLength}
              rows={3}
              className="w-full resize-none rounded-sm border border-border bg-input px-2 py-1 text-sm"
              onChange={(event) => setEdited({ of: draft, text: event.currentTarget.value })}
            />
            {props.preview?.(text)}
          </div>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={props.onCancel}>
            {t("assistant.rewrite.cancel")}
          </Button>
          {state.step === "draft" || state.step === "failed" ? (
            <Button variant="outline" onClick={props.onAgain}>
              {t("assistant.rewrite.again")}
            </Button>
          ) : null}
          {draft === undefined ? null : (
            <Button disabled={text.trim() === ""} onClick={() => props.onUse(text.trim())}>
              {t("assistant.rewrite.use")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
