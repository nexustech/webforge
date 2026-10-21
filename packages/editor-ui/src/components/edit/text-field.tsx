import { cn } from "../../lib/cn.js";
import type { FieldRendererProps } from "./field-registry.js";

/** Styles shared by the Edit panel's single-line controls: compact (28 px), on the input colour. */
export const fieldControlClass = cn(
  "h-7 w-full min-w-0 rounded-sm border border-border bg-input px-2 text-sm text-foreground",
  "outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:text-disabled",
);

/** A one-line text field. Every keystroke is a change; leaving the field ends the run. */
export function TextField({ id, value, onChange, onCommit }: FieldRendererProps) {
  return (
    <input
      id={id}
      type="text"
      className={fieldControlClass}
      value={typeof value === "string" ? value : ""}
      onChange={(event) => onChange(event.target.value)}
      onBlur={onCommit}
    />
  );
}
