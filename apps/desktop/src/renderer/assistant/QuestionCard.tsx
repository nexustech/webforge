import { Button, fieldControlClass } from "@webforge/editor-ui";
import { t } from "@webforge/i18n";
import { useId, useState } from "react";
import type { QuestionAnswer } from "../../shared/ipc/assistant.js";

/** Props of {@link QuestionCard}. */
export type QuestionCardProps = {
  readonly question: string;
  /** The answers offered, the one the assistant recommends first. */
  readonly answers: readonly string[];
  /** The person's answer, once given. */
  readonly answer?: QuestionAnswer | undefined;
  /** The reply waits on it: its answers can be chosen. */
  readonly waiting: boolean;
  /** An answer is on its way. */
  readonly busy: boolean;
  readonly onAnswer: (answer: QuestionAnswer) => void;
};

/**
 * A question the assistant asks before acting on a vague request (5.16, OL-1), in its reply: the
 * question as plain text, its answers as buttons, the recommended one first and marked, and a note
 * to go with the one chosen. Typing a message in the panel's box answers it too. Once answered,
 * the answer given; once the reply has ended without one, that it wasn't answered.
 */
export function QuestionCard({
  question,
  answers,
  answer,
  waiting,
  busy,
  onAnswer,
}: QuestionCardProps) {
  const id = useId();
  const [note, setNote] = useState("");
  const choose = (chosen: string) => {
    const kept = note.trim();
    onAnswer({ answer: chosen, ...(kept === "" ? {} : { note: kept }) });
  };
  return (
    <section
      aria-labelledby={`${id}-title ${id}-question`}
      className="flex flex-col gap-2 rounded-md border border-border bg-muted/40 p-2 text-xs"
    >
      <h3 id={`${id}-title`} className="m-0 text-xs font-semibold">
        {t("assistant.question.title")}
      </h3>
      <p id={`${id}-question`} className="m-0 whitespace-pre-wrap text-sm [overflow-wrap:anywhere]">
        {question}
      </p>
      {answer !== undefined ? (
        <dl className="m-0 flex flex-col gap-1">
          <dt className="font-semibold">{t("assistant.question.yourAnswer")}</dt>
          <dd className="m-0 whitespace-pre-wrap [overflow-wrap:anywhere]">{answer.answer}</dd>
          {answer.note === undefined ? null : (
            <>
              <dt className="font-semibold">{t("assistant.question.yourNote")}</dt>
              <dd className="m-0 whitespace-pre-wrap [overflow-wrap:anywhere]">{answer.note}</dd>
            </>
          )}
        </dl>
      ) : waiting ? (
        <>
          <ul
            aria-label={t("assistant.question.answers")}
            className="m-0 flex list-none flex-col gap-1 p-0"
          >
            {answers.map((each, index) => (
              // Two answers can read the same.
              <li key={`${index}:${each}`}>
                <Button
                  size="sm"
                  variant={index === 0 ? "default" : "outline"}
                  className="h-auto min-h-7 w-full justify-between gap-2 whitespace-normal py-1 text-left"
                  disabled={busy}
                  onClick={() => choose(each)}
                >
                  <span className="[overflow-wrap:anywhere]">{each}</span>
                  {index === 0 && answers.length > 1 ? (
                    <span className="shrink-0 text-2xs font-normal">
                      {t("assistant.question.recommended")}
                    </span>
                  ) : null}
                </Button>
              </li>
            ))}
          </ul>
          <label className="flex flex-col gap-1">
            <span>{t("assistant.question.note")}</span>
            <input
              type="text"
              value={note}
              maxLength={1000}
              disabled={busy}
              className={fieldControlClass}
              onChange={(event) => setNote(event.currentTarget.value)}
            />
          </label>
          <p className="m-0 text-muted-foreground">{t("assistant.question.orType")}</p>
        </>
      ) : (
        <p className="m-0 text-muted-foreground">{t("assistant.question.unanswered")}</p>
      )}
    </section>
  );
}
