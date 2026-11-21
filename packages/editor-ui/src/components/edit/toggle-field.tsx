import { cn } from "../../lib/cn.js";
import type { FieldRendererProps } from "./field-spec.js";
import { describedBy } from "./text-field.js";

/** On or off, as a switch. One click is one change. */
export function ToggleField({
  id,
  labelId,
  helpId,
  errorId,
  disabled = false,
  value,
  onChange,
  onCommit,
}: FieldRendererProps<"toggle">) {
  const on = value === true;
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={on}
      aria-labelledby={labelId}
      disabled={disabled}
      aria-invalid={errorId !== undefined}
      aria-describedby={describedBy(errorId, helpId)}
      // A 24 px target (LF-18) round the switch it draws.
      className="group flex size-7 shrink-0 items-center justify-center outline-none disabled:pointer-events-none"
      onClick={() => {
        onChange(!on);
        onCommit();
      }}
    >
      <span
        aria-hidden
        className={cn(
          "relative h-4 w-7 rounded-full border border-border transition-colors",
          "group-focus-visible:ring-2 group-focus-visible:ring-ring group-aria-invalid:border-destructive",
          // Disabled, a muted track and knob, on or off (#1010).
          on ? "bg-primary" : "bg-input",
          "group-disabled:bg-muted",
        )}
      >
        <span
          className={cn(
            "absolute top-px left-px size-3 rounded-full bg-foreground transition-transform",
            "group-disabled:bg-disabled",
            on && "translate-x-3",
          )}
        />
      </span>
    </button>
  );
}
