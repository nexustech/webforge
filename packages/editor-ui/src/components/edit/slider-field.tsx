import type { PointerEvent } from "react";
import { cn } from "../../lib/cn.js";
import type { FieldRendererProps } from "./field-spec.js";

/** How far the pointer moves for one step when scrubbing, in pixels; with Shift, finer. */
const SCRUB_STEP = 12;
const FINE_SCRUB_STEP = 36;

/**
 * A step along a token scale (C4), as a slider with the step's name beside it. Every step of a drag
 * is a change; letting go (or the key coming up) ends it, so a drag can be one undo step. The step's
 * name can be dragged left and right too (UX-20), a step per 12 pixels or, with Shift, per 36: a
 * scrub is one change too, ended when the pointer is let go.
 */
export function SliderField({
  id,
  field,
  value,
  onChange,
  onCommit,
}: FieldRendererProps<"slider">) {
  const { steps } = field;
  const index = Math.max(
    0,
    steps.findIndex((step) => step.value === value),
  );
  const scrub = (event: PointerEvent<HTMLOutputElement>) => {
    if (event.button !== 0 || steps.length < 2) return;
    event.preventDefault();
    const output = event.currentTarget;
    output.setPointerCapture(event.pointerId);
    let at = index;
    // Movement not yet turned into a step, so Shift changes the pace without a jump.
    let moved = 0;
    const move = (next: globalThis.PointerEvent) => {
      moved += next.movementX;
      const size = next.shiftKey ? FINE_SCRUB_STEP : SCRUB_STEP;
      const by = Math.trunc(moved / size);
      if (by === 0) return;
      moved -= by * size;
      const to = Math.min(Math.max(at + by, 0), steps.length - 1);
      const step = steps[to];
      if (to !== at && step !== undefined) {
        at = to;
        onChange(step.value);
      }
    };
    const end = () => {
      output.removeEventListener("pointermove", move);
      output.removeEventListener("pointerup", end);
      output.removeEventListener("pointercancel", end);
      onCommit();
    };
    output.addEventListener("pointermove", move);
    output.addEventListener("pointerup", end);
    output.addEventListener("pointercancel", end);
  };
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
      <output
        htmlFor={id}
        className="w-16 shrink-0 cursor-ew-resize touch-none text-right text-xs text-muted-foreground select-none"
        onPointerDown={scrub}
      >
        {steps[index]?.label}
      </output>
    </div>
  );
}
