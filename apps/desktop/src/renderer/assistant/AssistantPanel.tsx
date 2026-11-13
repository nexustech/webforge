import { Button } from "@webforge/editor-ui";
import type { ReadonlyStore } from "@webforge/history";
import { t } from "@webforge/i18n";
import { PlusIcon } from "lucide-react";
import { useState } from "react";
import { useStore } from "zustand";
import type { AssistantStatus, ReplyStep } from "../../shared/ipc/assistant.js";
import type { AssistantPanelModel } from "./assistant-state.js";
import { AppConsentDialog, type ConsentReach, SiteConsent } from "./Consent.js";
import { ConversationView, errorKey } from "./ConversationView.js";
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
  readonly onOpenPreferences: () => void;
  readonly onOpenVersions: () => void;
  readonly onShowStep: (step: ReplyStep) => void;
  readonly onOpenLink: (href: string) => void;
};

/** Who a request goes to, for the consent's wording. */
function reachOf(status: AssistantStatus): ConsentReach {
  if (status.provider.kind === "openrouter") {
    return { kind: "openrouter", maker: status.model?.maker ?? null };
  }
  if (status.provider.kind === "server") {
    return { kind: "server", host: new URL(status.provider.baseUrl).host };
  }
  return { kind: "this-computer" };
}

/**
 * The assistant's panel (6.9c, UX-28): the month's spend; the conversation on this site, each reply
 * with its review card; and a box to write in, with Send and Stop. Off until the person has turned
 * it on in Preferences, and asked again when its provider has changed to one their yes doesn't
 * cover (ADR 0026 §4); used on a site only once that site has its own yes.
 */
export function AssistantPanel(props: AssistantPanelProps) {
  const { model, history } = props;
  const { status, site, turns, replying, refused, safetyVersionId } = useStore(model.state);
  const position = useStore(history.state);
  const [kept, setKept] = useState<ReadonlySet<string>>(new Set());
  const [text, setText] = useState("");
  const [asking, setAsking] = useState(true);
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
          onClick={again ? () => setAsking(true) : props.onOpenPreferences}
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
    if (text.trim() === "" || replying !== undefined) return;
    void model.send(text, props.context());
    setText("");
  };
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-start gap-2 border-b border-border p-2">
        <div className="min-w-0 flex-1">
          <MonthReadout month={status.month} />
        </div>
        <Button
          size="sm"
          variant="ghost"
          disabled={turns.length === 0 || replying !== undefined}
          onClick={() => void model.newConversation()}
        >
          <PlusIcon aria-hidden />
          {t("assistant.newConversation")}
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <ConversationView
          turns={turns}
          onOpenLink={props.onOpenLink}
          afterReply={(turn) => {
            const steps = turns.find((each) => each.replyId === turn.replyId)?.steps ?? [];
            if (turn.state !== "done" || steps.length === 0 || kept.has(turn.replyId)) return null;
            const ids = steps.map((step) => step.entryId);
            return (
              <ReviewCard
                steps={steps}
                links={turns.find((each) => each.replyId === turn.replyId)?.links ?? []}
                undo={replyUndo(position, ids)}
                onKeep={() => setKept(new Set([...kept, turn.replyId]))}
                onUndo={() => {
                  // Read again: the history may have changed since the card was drawn.
                  const now = replyUndo(history.state.getState(), ids);
                  if (now.kind === "undo") history.jumpTo(now.to);
                }}
                onOpenVersions={
                  safetyVersionId === undefined ? () => undefined : props.onOpenVersions
                }
                onShowStep={props.onShowStep}
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
      <form
        className="flex flex-col gap-2 border-t border-border p-2"
        onSubmit={(event) => {
          event.preventDefault();
          send();
        }}
      >
        <textarea
          aria-label={t("assistant.message")}
          placeholder={t("assistant.messagePlaceholder")}
          value={text}
          rows={3}
          className="w-full resize-none rounded-sm border border-border bg-input px-2 py-1 text-sm"
          onChange={(event) => setText(event.currentTarget.value)}
          onKeyDown={(event) => {
            // Enter sends; Shift+Enter is a new line.
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              send();
            }
          }}
        />
        <div className="flex justify-end gap-2">
          {replying === undefined ? (
            <Button size="sm" type="submit" disabled={text.trim() === ""}>
              {t("assistant.send")}
            </Button>
          ) : (
            <Button size="sm" variant="outline" type="button" onClick={() => void model.stop()}>
              {t("assistant.stop")}
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
