import { cn } from "../../lib/cn.js";
import type { FieldRendererProps } from "./field-registry.js";

/** On or off, as a switch. One click is one change. */
export function ToggleField({
  id,
  labelId,
  helpId,
  value,
  onChange,
  onCommit,
}: FieldRendererProps) {
  const on = value === true;
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={on}
      aria-labelledby={labelId}
      aria-describedby={helpId}
      className={cn(
        "relative h-4 w-7 shrink-0 rounded-full border border-border transition-colors",
        "outline-none focus-visible:ring-2 focus-visible:ring-ring",
        on ? "bg-primary" : "bg-input",
      )}
      onClick={() => {
        onChange(!on);
        onCommit();
      }}
    >
      <span
        aria-hidden
        className={cn(
          "absolute top-px left-px size-3 rounded-full bg-foreground transition-transform",
          on && "translate-x-3",
        )}
      />
    </button>
  );
}
