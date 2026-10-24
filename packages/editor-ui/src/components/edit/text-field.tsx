import { useState } from "react";
import { cn } from "../../lib/cn.js";
import type { FieldRendererProps } from "./field-registry.js";

/** Styles shared by the Edit panel's single-line controls: compact (28 px), on the input colour. */
export const fieldControlClass = cn(
  "h-7 w-full min-w-0 rounded-sm border border-border bg-input px-2 text-sm text-foreground",
  "outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:text-disabled",
);

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
    return (
      <input
        id={id}
        type="text"
        className={fieldControlClass}
        value={stored}
        placeholder={field.placeholder}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onCommit}
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
  const errorId = `${id}-error`;
  return (
    <>
      <input
        id={id}
        type="text"
        className={cn(fieldControlClass, error !== null && "border-destructive")}
        value={draft ?? stored}
        placeholder={field.placeholder}
        spellCheck={false}
        aria-invalid={error !== null}
        aria-describedby={
          [error === null ? undefined : errorId, helpId].filter(Boolean).join(" ") || undefined
        }
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
        <p id={errorId} className="text-2xs text-destructive-text">
          {error}
        </p>
      )}
    </>
  );
}
