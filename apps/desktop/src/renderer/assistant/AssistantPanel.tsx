import { Button } from "@webforge/editor-ui";
import type { ReadonlyStore } from "@webforge/history";
import { t } from "@webforge/i18n";
import { PlusIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useStore } from "zustand";
import type { ReplyStep } from "../../shared/ipc/assistant.js";
import type { AssistantPanelModel } from "./assistant-state.js";
import { AppConsentDialog, reachOf, SiteConsent } from "./Consent.js";
import { ConversationView, errorKey } from "./ConversationView.js";
import { HeldCard } from "./HeldCard.js";
import { MonthReadout } from "./MonthReadout.js";
import { ReviewCard } from "./ReviewCard.js";
import { replyUndo } from "./reply-undo.js";

/** Undo History as the review card reads it, and how it undoes a reply's steps. */
type PanelHistory = {
  readonly state: ReadonlyStore<{
    readonly entries: readonly { readonly id: string }[];
    readonly cursor: number;
  }>;
  jumpTo(entryId: string | null): boolean;
};

/** Props of {@link AssistantPanel}. */
export type AssistantPanelProps = {
  readonly model: AssistantPanelModel;
  readonly history: PanelHistory;
  /** The site's name, for its consent. */
  readonly siteName: string;
  /** What's selected, sent with a message (ADR 0026 §6). */
  readonly context: () => { pageId?: string; nodeId?: string };
  /** Turns the assistant on at the consent's wording shown (ADR 0026 §4). */
  readonly onAgree: () => void;
  readonly onOpenSettings: () => void;
  readonly onOpenVersions: () => void;
  readonly onShowStep: (step: ReplyStep) => void;
  /** Whether the element a change is on holds an example now (#1228), for the review card. */
  readonly holdsExample?: ((step: ReplyStep) => boolean) | undefined;
  /** Opens a link from a reply in the browser: its address as the reply wrote it. */
  readonly onOpenLink: (href: string, replyId: string) => void;
  /** Opens *Things You Can Ask* (5.21, OL-8): example requests to try. */
  readonly onOpenExamples: () => void;
};

/**
 * The assistant's panel (6.9c, UX-28): the month's spend; the conversation on this site, each reply
 * with its review card; and a box to write in, with Send and Stop. Off until the person has turned
 * it on in Settings, and asked again when its provider has changed to one their yes doesn't
 * cover (ADR 0026 §4); used on a site only once that site has its own yes.
 */
export function AssistantPanel(props: AssistantPanelProps) {
  const { model, history } = props;
  const { status, site, turns, replying, refused, applying, waiting, returned, tried } = useStore(
    model.state,
  );
  const position = useStore(history.state);
  const [kept, setKept] = useState<ReadonlySet<string>>(new Set());
  const [text, setText] = useState("");
  const [asking, setAsking] = useState(true);
  // A held message given back, unsent (5.19): put in the box, before what's typed there now.
  useEffect(() => {
    if (returned === undefined) return;
    setText((now) => (now.trim() === "" ? returned : `${returned}\n\n${now}`));
    model.taken();
  }, [returned, model]);
  // An example to try (5.21): in the box, before what's typed there now, and the box focused.
  const box = useRef<HTMLTextAreaElement>(null);
  const [focusing, setFocusing] = useState(false);
  useEffect(() => {
    if (tried === undefined) return;
    setText((now) => (now.trim() === "" ? tried : `${tried}\n\n${now}`));
    setFocusing(true);
    model.tryTaken();
  }, [tried, model]);
  useEffect(() => {
    if (!focusing) return;
    const shown = box.current;
    if (shown !== null) {
      shown.focus();
      // At the example's end, ready to change it.
      shown.setSelectionRange(shown.value.length, shown.value.length);
    }
    setFocusing(false);
  }, [focusing]);
  if (status === undefined || site === undefined) {
    return <p className="m-0 p-3 text-sm text-muted-foreground">{t("assistant.loading")}</p>;
  }
  if (!status.enabled) {
    // Agreed once, for a provider that has since changed: asked again for this one.
    const again = status.consentVersion !== null;
    return (
      <div className="flex flex-col gap-2 p-3 text-sm">
        <p className="m-0">{t(again ? "assistant.reconsent" : "assistant.off")}</p>
        <Button
          size="sm"
          className="self-start"
          onClick={again ? () => setAsking(true) : props.onOpenSettings}
        >
          {t(again ? "assistant.consent.agree" : "assistant.setUp")}
        </Button>
        {again ? (
          <AppConsentDialog
            open={asking}
            reach={reachOf(status)}
            onAgree={props.onAgree}
            onCancel={() => setAsking(false)}
          />
        ) : null}
      </div>
    );
  }
  const reach = reachOf(status);
  if (reach.kind !== "this-computer" && !site.allowed) {
    return site.asked ? (
      <div className="flex flex-col gap-2 p-3 text-sm">
        <p className="m-0">{t("assistant.siteDenied")}</p>
        <Button size="sm" className="self-start" onClick={() => void model.answerSite(true)}>
          {t("assistant.site.allow")}
        </Button>
      </div>
    ) : (
      <SiteConsent
        site={props.siteName}
        reach={reach}
        onAnswer={(allowed) => void model.answerSite(allowed)}
      />
    );
  }
  const send = () => {
    if (text.trim() === "") return;
    // While a reply is under way, held to send when it finishes (5.19, OL-4).
    if (replying !== undefined) {
      model.hold(text, props.context());
      setText("");
      return;
    }
    // Cleared once main has taken it: a refused message stays, to send again (#1000 review).
    const sent = text;
    void model.send(sent, props.context()).then((taken) => {
      if (taken) setText((now) => (now === sent ? "" : now));
    });
  };
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-start gap-2 border-b border-border p-2">
        <div className="min-w-0 flex-1">
          <MonthReadout month={status.month} />
        </div>
        <div className="flex flex-col items-end gap-1">
          <Button
            size="sm"
            variant="ghost"
            disabled={turns.length === 0 || replying !== undefined}
            onClick={() => void model.newConversation()}
          >
            <PlusIcon aria-hidden />
            {t("assistant.newConversation")}
          </Button>
          {/* This site's yes taken back (AIA-6): asked only where requests leave this computer. */}
          {reach.kind === "this-computer" ? null : (
            <Button
              size="sm"
              variant="ghost"
              disabled={replying !== undefined}
              onClick={() => void model.answerSite(false)}
            >
              {t("assistant.site.stop")}
            </Button>
          )}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <ConversationView
          turns={turns}
          onOpenLink={props.onOpenLink}
          afterReply={(turn) => {
            const shown = turns.find((each) => each.replyId === turn.replyId);
            if (shown === undefined || turn.state !== "done" || kept.has(turn.replyId)) return null;
            // Review before applying (6.9e): its changes wait for the person, or were dropped.
            if (shown.held.length > 0 || shown.heldOutcome !== undefined) {
              return (
                <HeldCard
                  held={shown.held}
                  links={shown.links}
                  outcome={shown.heldOutcome}
                  applying={applying === turn.replyId}
                  onApply={() => void model.applyHeld(turn.replyId)}
                  onDiscard={() => void model.discardHeld(turn.replyId)}
                />
              );
            }
            const { steps } = shown;
            const refusedChanges = shown.refused ?? [];
            if (steps.length === 0 && refusedChanges.length === 0) return null;
            const ids = steps.map((step) => step.entryId);
            return (
              <ReviewCard
                steps={steps}
                links={shown.links}
                refused={refusedChanges}
                undo={replyUndo(position, ids)}
                onKeep={() => setKept(new Set([...kept, turn.replyId]))}
                onUndo={() => {
                  // Read again: the history may have changed since the card was drawn.
                  const now = replyUndo(history.state.getState(), ids);
                  if (now.kind === "undo") history.jumpTo(now.to);
                }}
                // Version History lists the safety version, known here or not.
                onOpenVersions={props.onOpenVersions}
                onShowStep={props.onShowStep}
                holdsExample={props.holdsExample}
              />
            );
          }}
        />
      </div>
      {refused === undefined ? null : (
        <p role="alert" className="m-0 px-3 pb-1 text-xs text-destructive-text">
          {t(errorKey(refused))}
        </p>
      )}
      {waiting === undefined ? null : (
        <section
          aria-label={t("assistant.waiting.label")}
          className="mx-2 mt-2 flex flex-col gap-1 rounded-md border border-border bg-muted p-2 text-sm"
        >
          <p className="m-0 text-xs font-semibold text-muted-foreground">
            {t(
              waiting.afterChanges === true
                ? "assistant.waiting.afterChanges"
                : "assistant.waiting.title",
            )}
          </p>
          <p className="m-0 whitespace-pre-wrap [overflow-wrap:anywhere]">{waiting.text}</p>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => model.removeWaiting()}>
              {t("assistant.waiting.remove")}
            </Button>
            <Button size="sm" variant="outline" onClick={() => model.editWaiting()}>
              {t("assistant.waiting.edit")}
            </Button>
          </div>
        </section>
      )}
      <form
        className="flex flex-col gap-2 border-t border-border p-2"
        onSubmit={(event) => {
          event.preventDefault();
          send();
        }}
      >
        <textarea
          ref={box}
          aria-label={t("assistant.message")}
          placeholder={t("assistant.messagePlaceholder")}
          value={text}
          rows={3}
          className="w-full resize-none rounded-sm border border-border bg-input px-2 py-1 text-sm"
          onChange={(event) => setText(event.currentTarget.value)}
          onKeyDown={(event) => {
            // Enter sends; Shift+Enter is a new line. Not while an input method composes a word:
            // its Enter confirms the word (keyCode 229 where isComposing isn't set).
            const composing = event.nativeEvent.isComposing || event.keyCode === 229;
            if (event.key === "Enter" && !event.shiftKey && !composing) {
              event.preventDefault();
              send();
            }
          }}
        />
        <div className="flex flex-wrap items-center justify-end gap-2">
          {/* Example requests to try (5.21, OL-8). */}
          <Button
            size="sm"
            variant="link"
            type="button"
            className="mr-auto px-0"
            onClick={props.onOpenExamples}
          >
            {t("assistant.examples.open")}
          </Button>
          {replying === undefined ? (
            <Button size="sm" type="submit" disabled={text.trim() === ""}>
              {t("assistant.send")}
            </Button>
          ) : (
            <>
              <Button size="sm" variant="outline" type="button" onClick={() => void model.stop()}>
                {t("assistant.stop")}
              </Button>
              {/* Held, and sent by itself once this reply finishes (5.19, OL-4). */}
              <Button size="sm" type="submit" disabled={text.trim() === ""}>
                {t("assistant.sendAfter")}
              </Button>
            </>
          )}
        </div>
      </form>
    </div>
  );
}
