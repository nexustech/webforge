import { useState } from "react";
import { cn } from "../../lib/cn.js";
import type { FieldRendererProps } from "./field-spec.js";

/** Styles shared by the Edit panel's single-line controls: compact (28 px), on the input colour. */
export const fieldControlClass = cn(
  "h-7 w-full min-w-0 rounded-sm border border-border bg-input px-2 text-sm text-foreground",
  "outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:text-disabled",
  "aria-invalid:border-destructive",
);

/** A control's `aria-describedby`: the ids given (its error, then its help), or none. */
export const describedBy = (...ids: readonly (string | undefined)[]): string | undefined =>
  ids.filter((id) => id !== undefined).join(" ") || undefined;

/**
 * A one-line text field. Every keystroke is a change; leaving the field ends the run.
 *
 * A field with `validate` (an anchor ID, CSS classes) changes nothing while the user types: they
 * may pass through invalid text on the way to valid text. Leaving the field or pressing Enter
 * reports the text if it is valid, else shows why not and keeps it; Esc goes back to the value.
 */
export function TextField({
  id,
  helpId,
  errorId,
  disabled = false,
  field,
  value,
  onChange,
  onCommit,
}: FieldRendererProps<"text">) {
  const stored = typeof value === "string" ? value : "";
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { validate } = field;
  if (validate === undefined) {
    const shared = {
      id,
      value: stored,
      placeholder: field.placeholder,
      maxLength: field.maxLength,
      disabled,
      "aria-invalid": errorId !== undefined,
      "aria-describedby": describedBy(errorId, helpId),
      onBlur: onCommit,
    };
    return field.multiline === true ? (
      <textarea
        {...shared}
        className={cn(fieldControlClass, "h-16 resize-none py-1")}
        onChange={(event) => onChange(event.target.value)}
      />
    ) : (
      <input
        {...shared}
        type={field.inputType ?? "text"}
        className={fieldControlClass}
        onChange={(event) => onChange(event.target.value)}
      />
    );
  }
  const commit = () => {
    if (draft === null) {
      return;
    }
    if (draft === stored) {
      // Typed back to what it was: nothing to check or change.
      setDraft(null);
      setError(null);
      onCommit();
      return;
    }
    const problem = validate(draft);
    if (problem !== undefined) {
      setError(problem);
      return;
    }
    setDraft(null);
    setError(null);
    onChange(draft);
    onCommit();
  };
  // Its own check's message, before the one the panel shows (`errorId`).
  const checkId = `${id}-check`;
  return (
    <>
      <input
        id={id}
        type="text"
        className={fieldControlClass}
        value={draft ?? stored}
        placeholder={field.placeholder}
        spellCheck={false}
        disabled={disabled}
        aria-invalid={error !== null || errorId !== undefined}
        aria-describedby={describedBy(error === null ? undefined : checkId, errorId, helpId)}
        onChange={(event) => {
          setDraft(event.target.value);
          setError(null);
        }}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            commit();
          } else if (event.key === "Escape" && draft !== null) {
            setDraft(null);
            setError(null);
          }
        }}
      />
      {error === null ? null : (
        <p id={checkId} className="text-2xs text-destructive-text">
          {error}
        </p>
      )}
    </>
  );
}
