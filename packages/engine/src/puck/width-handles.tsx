import { t } from "@webforge/i18n";
import { type Breakpoint, resolveResponsive } from "@webforge/model";
import type { ComponentLibrary } from "@webforge/site-components";
import {
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { FieldDrag } from "../canvas-engine.js";
import { componentSelector } from "./puck-dom.js";

/** A slider field that sets how wide its element is, as its width handles need it (2.17). */
export type WidthHandleField = {
  readonly name: string;
  readonly label: string;
  /** Its steps, narrowest first, each with its width in CSS pixels (`null`: the container's). */
  readonly steps: readonly {
    readonly value: string;
    readonly label: string;
    readonly px: number | null;
  }[];
};

/** The first slider field of component `type` that gives its steps' widths, if it has one. */
export function widthHandleField(
  library: ComponentLibrary | null,
  type: string,
): WidthHandleField | undefined {
  const fields = library?.components[type]?.fields ?? {};
  for (const [name, field] of Object.entries(fields)) {
    if (field.kind !== "slider" || field.widths === undefined) continue;
    const widths = field.widths;
    const steps = field.steps.flatMap((step) =>
      step.value in widths
        ? [{ value: step.value, label: step.label, px: widths[step.value] ?? null }]
        : [],
    );
    if (steps.length > 0) return { name, label: field.label, steps };
  }
  return undefined;
}

/** The edge an element is held by as its width changes: the other one moves. */
export type WidthAnchor = "left" | "right" | "centre";

/**
 * Where `element` is held in `container` (its content box): by the side it touches, or by its
 * middle if it touches neither. One as wide as its container is held as `alignment` says.
 */
export function anchorOf(
  element: { readonly left: number; readonly right: number },
  container: { readonly left: number; readonly right: number },
  alignment: unknown,
): WidthAnchor {
  const touchesLeft = element.left - container.left < 1;
  const touchesRight = container.right - element.right < 1;
  if (touchesLeft && !touchesRight) return "left";
  if (touchesRight && !touchesLeft) return "right";
  if (touchesLeft && touchesRight) {
    return alignment === "left" ? "left" : alignment === "right" ? "right" : "centre";
  }
  return "centre";
}

/** The width that puts the moving edge at `x`, for an element at `left`–`right` held by `anchor`. */
export function widthAt(
  anchor: WidthAnchor,
  x: number,
  element: { readonly left: number; readonly right: number },
): number {
  if (anchor === "left") return x - element.left;
  if (anchor === "right") return element.right - x;
  return 2 * Math.abs(x - (element.left + element.right) / 2);
}

/**
 * The step whose width is nearest `width` in a container `containerWidth` wide. Steps that show as
 * wide as each other (each capped at the container) tie, and the widest wins: in a narrow column
 * Large shows as Full does, and dragging to the column's edge must still give Full.
 */
export function nearestStep(
  steps: WidthHandleField["steps"],
  width: number,
  containerWidth: number,
): WidthHandleField["steps"][number] | undefined {
  let best: WidthHandleField["steps"][number] | undefined;
  let bestGap = Number.POSITIVE_INFINITY;
  for (const step of steps) {
    // A step never shows wider than the container.
    const shown = Math.min(step.px ?? containerWidth, containerWidth);
    const gap = Math.abs(shown - width);
    // Narrowest first, so a tie goes to the later, wider step.
    if (gap <= bestGap) {
      best = step;
      bestGap = gap;
    }
  }
  return best;
}

/** The element node `nodeId` draws: Puck wraps each element in a `div` of its own. */
function elementOf(document: Document, nodeId: string): Element | null | undefined {
  return document.querySelector(componentSelector(nodeId))?.firstElementChild;
}

/**
 * The handles' styles (2.17): white grips with a magenta edge on the element's left and right
 * edges, taller than the spacing grips, so the two can't be taken for each other; the same size on
 * screen whatever the zoom. The outline is as wide as Puck's wrapper, which can be wider than the
 * element (a Small Image in a wide column), so the grips sit in a box over the element itself.
 */
export const WIDTH_HANDLES_CSS = `
.wf-width-grips {
  position: absolute;
  inset: 0;
  pointer-events: none;
}
.wf-width-grip {
  position: absolute;
  top: calc(50% - 20px / var(--wf-zoom, 1));
  box-sizing: border-box;
  width: calc(8px / var(--wf-zoom, 1));
  height: calc(40px / var(--wf-zoom, 1));
  padding: 0;
  border: calc(2px / var(--wf-zoom, 1)) solid var(--wf-outline-color);
  border-radius: calc(4px / var(--wf-zoom, 1));
  background: #fff;
  cursor: ew-resize;
  pointer-events: auto;
  touch-action: none;
}
.wf-width-grip[data-side="left"] { left: calc(-4px / var(--wf-zoom, 1)); }
.wf-width-grip[data-side="right"] { right: calc(-4px / var(--wf-zoom, 1)); }
`;

/** Props of {@link WidthHandles}. */
export type WidthHandlesProps = {
  readonly nodeId: string;
  readonly field: WidthHandleField;
  /** The element's props, for its width and alignment. */
  readonly props: Readonly<Record<string, unknown>> | undefined;
  /**
   * The device view the canvas shows, whose value a drag changes: as the app writes it, which a
   * custom width's frame can't be trusted to say while it resizes.
   */
  readonly breakpoint: () => Breakpoint;
  readonly onFieldDrag: (drag: FieldDrag) => void;
};

/**
 * Grips on the selected element's left and right edges for its width (2.17, F-ED-25). Dragging
 * one moves that edge, the other held where the element is aligned, and sets the width to the step
 * nearest where it is let go: shown live, and as one undo step for the device the canvas shows. Esc
 * cancels a drag. The grips are for the mouse; the Edit panel's slider sets the same from the
 * keyboard.
 */
export function WidthHandles({
  nodeId,
  field,
  props,
  breakpoint: shownBreakpoint,
  onFieldDrag,
}: WidthHandlesProps) {
  const [readout, setReadout] = useState<string | null>(null);
  // The element's left and right edges, in from the outline's: where the grips go.
  const gripsBox = useRef<HTMLSpanElement>(null);
  const [edges, setEdges] = useState({ left: 0, right: 0 });
  const remeasure = useRef<(() => void) | null>(null);
  useLayoutEffect(() => {
    const grips = gripsBox.current;
    const outline = grips?.parentElement;
    const document = grips?.ownerDocument;
    const wrapper = document?.querySelector(componentSelector(nodeId));
    const frame = document?.defaultView;
    if (!outline || !wrapper || !document || !frame) return;
    let element: Element | null = null;
    // It changes size as its width does, mid-drag too, and as the column does. Puck keeps its
    // wrapper, but the element in it can change (an Image given its picture), so it is found each
    // time.
    const resizes = new frame.ResizeObserver(() => measure());
    const measure = () => {
      const now = wrapper.firstElementChild;
      if (now !== element) {
        if (element !== null) resizes.unobserve(element);
        if (now !== null) resizes.observe(now);
        element = now;
      }
      if (element === null) return;
      const shown = element.getBoundingClientRect();
      const around = outline.getBoundingClientRect();
      const left = Math.round(shown.left - around.left);
      const right = Math.round(around.right - shown.right);
      setEdges((edges) => (edges.left === left && edges.right === right ? edges : { left, right }));
    };
    resizes.observe(wrapper);
    resizes.observe(outline);
    // It moves without changing size when the site's styles arrive for a class it was just given
    // (a new alignment): they come after the render, into the frame's head.
    const styles = new frame.MutationObserver(() => measure());
    styles.observe(document.head, { childList: true, subtree: true, characterData: true });
    remeasure.current = measure;
    measure();
    return () => {
      resizes.disconnect();
      styles.disconnect();
      remeasure.current = null;
    };
  }, [nodeId]);
  // And after every render: a change to its alignment or margin moves it without resizing it.
  useLayoutEffect(() => remeasure.current?.());
  // Cancels the drag going on, if any: grips that go mid-drag leave no listeners behind.
  const cancelDrag = useRef<(() => void) | null>(null);
  useEffect(() => () => cancelDrag.current?.(), []);

  const begin = (event: ReactPointerEvent<HTMLButtonElement>) => {
    // Not a click on the element underneath: no selecting, no dragging it.
    event.stopPropagation();
    event.preventDefault();
    if (event.button !== 0 || cancelDrag.current !== null) return;
    const grip = event.currentTarget;
    const frame = grip.ownerDocument.defaultView;
    const element = elementOf(grip.ownerDocument, nodeId);
    const container = element?.parentElement;
    if (!frame || element === null || element === undefined || !container) return;
    // The value for the device the canvas shows.
    const breakpoint = shownBreakpoint();
    const before = resolveResponsive<unknown>(props?.[field.name], breakpoint);
    const report = (phase: FieldDrag["phase"], value: unknown) =>
      onFieldDrag({ phase, nodeId, field: field.name, value });

    const rect = element.getBoundingClientRect();
    const box = container.getBoundingClientRect();
    const style = frame.getComputedStyle(container);
    const inner = {
      left: box.left + (Number.parseFloat(style.paddingLeft) || 0),
      right: box.right - (Number.parseFloat(style.paddingRight) || 0),
    };
    const anchor = anchorOf(rect, inner, props?.alignment);
    let current = before;
    report("start", before);
    grip.setPointerCapture(event.pointerId);

    const move = (moved: PointerEvent) => {
      const step = nearestStep(
        field.steps,
        widthAt(anchor, moved.clientX, rect),
        inner.right - inner.left,
      );
      if (step === undefined) return;
      setReadout(t("canvas.width.readout", { field: field.label, size: step.label }));
      if (step.value !== current) {
        current = step.value;
        report("update", step.value);
      }
    };
    const windows = [frame, frame.parent].filter(
      (each, index, all): each is Window => each !== null && all.indexOf(each) === index,
    );
    const stop = () => {
      grip.removeEventListener("pointermove", move);
      grip.removeEventListener("pointerup", end);
      grip.removeEventListener("pointercancel", cancel);
      for (const each of windows) each.removeEventListener("keydown", onKey, true);
      if (grip.hasPointerCapture(event.pointerId)) grip.releasePointerCapture(event.pointerId);
      cancelDrag.current = null;
      setReadout(null);
    };
    const end = () => {
      stop();
      report("commit", current);
    };
    const cancel = () => {
      stop();
      report("cancel", before);
    };
    // Esc cancels; nothing else sees it, wherever the focus is.
    const onKey = (pressed: KeyboardEvent) => {
      if (pressed.key !== "Escape") return;
      pressed.preventDefault();
      pressed.stopImmediatePropagation();
      cancel();
    };
    cancelDrag.current = cancel;
    grip.addEventListener("pointermove", move);
    grip.addEventListener("pointerup", end);
    grip.addEventListener("pointercancel", cancel);
    for (const each of windows) each.addEventListener("keydown", onKey, true);
  };

  return (
    <span ref={gripsBox} className="wf-width-grips" style={edges}>
      {(["left", "right"] as const).map((side) => (
        <button
          key={side}
          type="button"
          tabIndex={-1}
          aria-hidden
          className="wf-width-grip"
          data-side={side}
          title={t("canvas.width.handle", { field: field.label })}
          onPointerDown={begin}
          onClick={(event) => event.stopPropagation()}
        />
      ))}
      {readout === null ? null : <span className="wf-grip-readout">{readout}</span>}
    </span>
  );
}
