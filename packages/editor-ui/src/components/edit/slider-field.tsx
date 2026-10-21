import { cn } from "../../lib/cn.js";
import type { FieldRendererProps } from "./field-registry.js";

/**
 * A step along a token scale (C4), as a slider with the step's name beside it. Every step of a drag
 * is a change; letting go (or the key coming up) ends it, so a drag can be one undo step.
 */
export function SliderField({ id, field, value, onChange, onCommit }: FieldRendererProps) {
  const steps = field.steps ?? [];
  const index = Math.max(
    0,
    steps.findIndex((step) => step.value === value),
  );
  return (
    <div className="flex items-center gap-2">
      <input
        id={id}
        type="range"
        min={0}
        max={Math.max(steps.length - 1, 0)}
        step={1}
        value={index}
        aria-valuetext={steps[index]?.label}
        className={cn("h-7 min-w-0 flex-1 accent-primary", "focus-visible:outline-none")}
        onChange={(event) => {
          const step = steps[Number(event.target.value)];
          if (step !== undefined) onChange(step.value);
        }}
        // Wherever the pointer is let go, not only over the slider.
        onPointerDown={(event) =>
          event.currentTarget.ownerDocument.defaultView?.addEventListener("pointerup", onCommit, {
            once: true,
          })
        }
        onKeyUp={onCommit}
        onBlur={onCommit}
      />
      <output htmlFor={id} className="w-16 shrink-0 text-right text-xs text-muted-foreground">
        {steps[index]?.label}
      </output>
    </div>
  );
}
