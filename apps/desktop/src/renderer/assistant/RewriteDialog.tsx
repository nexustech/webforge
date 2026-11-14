import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@webforge/editor-ui";
import type { RewriteHow } from "@webforge/engine";
import { t } from "@webforge/i18n";
import { useId } from "react";
import { type AssistantErrorCode, DRAFT_TEXT_MAX } from "../../shared/ipc/assistant.js";
import { type AwayReach, SiteConsent } from "./Consent.js";

/** Where a rewrite has got to. */
export type RewriteState =
  /** This site hasn't been asked yet (ADR 0026 §4): its question first. */
  | { readonly step: "site"; readonly site: string; readonly reach: AwayReach }
  /** The person said no to this site. */
  | { readonly step: "denied" }
  | { readonly step: "writing" }
  | { readonly step: "draft"; readonly text: string }
  /** More text selected than a draft takes. */
  | { readonly step: "too-long" }
  | { readonly step: "failed"; readonly error: AssistantErrorCode };

/** Props of {@link RewriteDialog}. */
export type RewriteDialogProps = {
  readonly open: boolean;
  readonly how: RewriteHow;
  /** The selected text. */
  readonly original: string;
  /** Whether the selection has formatting a rewrite leaves out. */
  readonly formatted: boolean;
  readonly state: RewriteState;
  readonly onSiteAnswer: (allowed: boolean) => void;
  readonly onUse: (text: string) => void;
  readonly onAgain: () => void;
  readonly onCancel: () => void;
};

/**
 * The assistant's rewrite of selected text (G25a, #873), for review: the person's text and the
 * suggestion side by side, with *Use This*, *Try Again* and *Cancel*. Nothing changes until they
 * use it. Asks this site's question first if it hasn't been asked (ADR 0026 §4).
 */
export function RewriteDialog(props: RewriteDialogProps) {
  const { state } = props;
  const id = useId();
  const message =
    state.step === "denied"
      ? t("assistant.siteDenied")
      : state.step === "too-long"
        ? t("assistant.rewrite.tooLong", { count: DRAFT_TEXT_MAX.toLocaleString() })
        : state.step === "failed"
          ? t(`assistant.error.${state.error}`)
          : undefined;
  return (
    <Dialog
      open={props.open}
      onOpenChange={(next) => {
        if (!next) props.onCancel();
      }}
    >
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("assistant.rewrite.title")}</DialogTitle>
          <DialogDescription>
            {t("assistant.rewrite.description", {
              how: t(`canvas.richText.rewrite.${props.how}`),
            })}
          </DialogDescription>
        </DialogHeader>
        {state.step === "site" ? (
          <SiteConsent site={state.site} reach={state.reach} onAnswer={props.onSiteAnswer} />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <section aria-labelledby={`${id}-original`} className="flex min-w-0 flex-col gap-1">
              <h3 id={`${id}-original`} className="m-0 text-xs font-semibold text-muted-foreground">
                {t("assistant.rewrite.original")}
              </h3>
              <p className="m-0 max-h-64 overflow-y-auto whitespace-pre-wrap rounded-md border border-border p-2 text-sm text-muted-foreground">
                {props.original}
              </p>
            </section>
            <section
              aria-labelledby={`${id}-suggestion`}
              aria-busy={state.step === "writing"}
              className="flex min-w-0 flex-col gap-1"
            >
              <h3 id={`${id}-suggestion`} className="m-0 text-xs font-semibold">
                {t("assistant.rewrite.suggestion")}
              </h3>
              <p
                role={message === undefined ? undefined : "alert"}
                className="m-0 max-h-64 min-h-16 overflow-y-auto whitespace-pre-wrap rounded-md border border-border p-2 text-sm"
              >
                {state.step === "draft"
                  ? state.text
                  : state.step === "writing"
                    ? t("assistant.rewrite.writing")
                    : message}
              </p>
            </section>
          </div>
        )}
        {props.formatted && state.step === "draft" ? (
          <p className="m-0 text-xs text-muted-foreground">{t("assistant.rewrite.formatting")}</p>
        ) : null}
        <DialogFooter>
          <Button variant="ghost" onClick={props.onCancel}>
            {t("assistant.rewrite.cancel")}
          </Button>
          {state.step === "draft" || state.step === "failed" ? (
            <Button variant="outline" onClick={props.onAgain}>
              {t("assistant.rewrite.again")}
            </Button>
          ) : null}
          {state.step === "draft" ? (
            <Button onClick={() => props.onUse(state.text)}>{t("assistant.rewrite.use")}</Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
