import { plural, t } from "@webforge/i18n";
import type { ReactNode } from "react";
import { money } from "./money.js";
import { ReplyText } from "./ReplyText.js";

/** A change one tool call made: one undo step (ADR 0026 §7's `ReplyStep`). */
type StepView = {
  readonly entryId: string;
  /** "AI (Assistant): Edited Hero text". */
  readonly label: string;
  readonly target?: { readonly pageId: string; readonly nodeId?: string } | undefined;
};

/** How a tool call came out (ADR 0026 §7's `tool` events). */
type ToolState = "running" | "done" | "refused" | "declined" | "busy" | "invalid" | "failed";

/** A tool call of a reply, as its events said; a read has no step. */
type ToolView = {
  readonly callId: string;
  readonly state: ToolState;
  readonly step?: StepView | undefined;
};

/** Why a reply ended (ADR 0026 §7). */
type StopReason =
  | "end"
  | "stopped"
  | "tool-cap"
  | "model-call-cap"
  | "max-tokens"
  | "limit-reached";

/** One exchange, shaped like ADR 0026 §7's `ConversationTurn`, with its tool calls as they came. */
export type TurnView = {
  readonly replyId: string;
  /** What the person sent. */
  readonly message: string;
  /** The reply's text so far. */
  readonly reply: string;
  readonly state: "replying" | "done" | "failed";
  readonly stop?: StopReason | undefined;
  /** An `AssistantErrorCode`, worded here: never the provider's own text. */
  readonly error?: string | undefined;
  readonly costUsd: number | null;
  readonly tools: readonly ToolView[];
};

/** Props of {@link ConversationView}. */
export type ConversationViewProps = {
  readonly turns: readonly TurnView[];
  /** Opens a web address from a reply in the browser, once clicked. */
  readonly onOpenLink: (href: string) => void;
  /** Drawn under a reply that has ended: 6.9c's review card. */
  readonly afterReply?: (turn: TurnView) => ReactNode;
};

/** The "AI (Assistant): " every step's label starts with, which the reply needn't repeat. */
const LABEL_PREFIX = /^AI \([^)]*\): /;

/** What a reply's tool calls did: the changes by name, the lookups counted, anything refused. */
function ToolSummary({ tools }: { readonly tools: readonly ToolView[] }) {
  const running = tools.some((tool) => tool.state === "running");
  const reads = tools.filter((tool) => tool.state === "done" && tool.step === undefined).length;
  const steps = tools.flatMap((tool) => (tool.state === "done" && tool.step ? [tool.step] : []));
  const problems = tools.filter((tool) => tool.state !== "done" && tool.state !== "running");
  return (
    <div className="flex flex-col gap-1 text-xs text-muted-foreground">
      {reads === 0 ? null : <p className="m-0">{plural("assistant.tool.read", reads)}</p>}
      {steps.length === 0 ? null : (
        <ul aria-label={t("assistant.steps")} className="m-0 list-disc pl-5 text-foreground">
          {steps.map((step) => (
            <li key={step.entryId}>{step.label.replace(LABEL_PREFIX, "")}</li>
          ))}
        </ul>
      )}
      {problems.map((tool) => (
        <p key={tool.callId} className="m-0">
          {t(`assistant.tool.${tool.state as Exclude<ToolState, "running" | "done">}`)}
        </p>
      ))}
      {running ? (
        <p role="status" className="m-0">
          {t("assistant.tool.running")}
        </p>
      ) : null}
    </div>
  );
}

/** One exchange: the person's message, then the reply as it streams, what it did, and its cost. */
function Turn({
  turn,
  onOpenLink,
  afterReply,
}: {
  readonly turn: TurnView;
  readonly onOpenLink: (href: string) => void;
  readonly afterReply: ConversationViewProps["afterReply"];
}) {
  const ended = turn.state !== "replying";
  return (
    <li className="flex flex-col gap-2">
      <div className="self-end rounded-md bg-accent px-3 py-2 text-sm text-accent-foreground">
        <span className="sr-only">{t("assistant.you")}: </span>
        <span className="whitespace-pre-wrap">{turn.message}</span>
      </div>
      <div className="flex flex-col gap-2">
        <span className="sr-only">{t("assistant.name")}:</span>
        {turn.reply === "" && !ended ? (
          <p className="m-0 text-sm text-muted-foreground">{t("assistant.replying")}</p>
        ) : (
          <ReplyText text={turn.reply} onOpenLink={onOpenLink} />
        )}
        {turn.tools.length === 0 ? null : <ToolSummary tools={turn.tools} />}
        {turn.state === "done" && turn.stop !== undefined && turn.stop !== "end" ? (
          <p className="m-0 text-xs text-muted-foreground">{t(`assistant.stop.${turn.stop}`)}</p>
        ) : null}
        {turn.state === "failed" ? (
          <p role="alert" className="m-0 text-xs text-destructive-text">
            {t(errorKey(turn.error))}
          </p>
        ) : null}
        {ended && turn.costUsd !== null ? (
          <p className="m-0 text-2xs text-muted-foreground">
            {t("assistant.cost.reply", { cost: money(turn.costUsd) })}
          </p>
        ) : null}
        {ended ? afterReply?.(turn) : null}
      </div>
    </li>
  );
}

/** The error codes the panel words (ADR 0026 §7); any other falls back to *failed*. */
const ERRORS = [
  "consent-needed",
  "not-signed-in",
  "no-model",
  "limit-reached",
  "busy",
  "no-site",
  "offline",
  "unauthorized",
  "no-credit",
  "rate-limited",
  "model-unavailable",
  "provider-error",
  "failed",
] as const;

/** The message for an error code. */
export function errorKey(code: string | undefined) {
  const known = ERRORS.find((each) => each === code) ?? "failed";
  return `assistant.error.${known}` as const;
}

/**
 * The assistant's conversation on this site (6.9c, ADR 0026 §7): each message and its reply as it
 * streams, in limited Markdown and never as HTML, what the reply's tool calls did, why it stopped
 * early, and its cost in money. A reply is announced politely once it has ended (a log, busy while
 * one streams).
 */
export function ConversationView({ turns, onOpenLink, afterReply }: ConversationViewProps) {
  if (turns.length === 0) {
    return <p className="m-0 p-3 text-sm text-muted-foreground">{t("assistant.empty")}</p>;
  }
  return (
    // The log is the list's container: a list keeps its own role, for its items. Busy while a
    // reply streams, so a screen reader announces it once it has ended, not delta by delta.
    <div
      role="log"
      aria-label={t("assistant.conversation")}
      aria-busy={turns.some((turn) => turn.state === "replying")}
    >
      <ol className="m-0 flex list-none flex-col gap-4 p-3">
        {turns.map((turn) => (
          <Turn key={turn.replyId} turn={turn} onOpenLink={onOpenLink} afterReply={afterReply} />
        ))}
      </ol>
    </div>
  );
}
