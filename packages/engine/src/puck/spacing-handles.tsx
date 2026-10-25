import { t } from "@webforge/i18n";
import {
  BOX_SIDES,
  type BoxSide,
  type BoxValue,
  type Breakpoint,
  boxValueOf,
  resolveResponsive,
  responsiveBoxOf,
  SPACING_TOKENS,
  type SpacingToken,
} from "@webforge/model";
import { boxTokenPixels, type ComponentLibrary } from "@webforge/site-components";
import { type PointerEvent as ReactPointerEvent, useEffect, useRef, useState } from "react";
import type { FieldDrag } from "../canvas-engine.js";
import { componentSelector } from "./puck-dom.js";

/** A `box` field of a component, as its handles need it. */
export type BoxHandleField = {
  readonly name: string;
  readonly label: string;
  readonly property: "padding" | "margin";
  readonly sides: readonly BoxSide[];
};

/** The `box` fields of component `type`, in the order its fields list them. */
export function boxHandleFields(
  library: ComponentLibrary | null,
  type: string,
): readonly BoxHandleField[] {
  const fields = library?.components[type]?.fields ?? {};
  return Object.entries(fields).flatMap(([name, field]) =>
    field.kind === "box"
      ? [{ name, label: field.label, property: field.property, sides: field.sides ?? BOX_SIDES }]
      : [],
  );
}

/**
 * The handles' styles (UI1 §3, 1.32, SP-3): thin grips, inside the element's edges for padding and
 * outside them for margin, tinted as the spacing overlay tints them (padding green, margin warm),
 * the same size on screen whatever the zoom. Top and bottom grips sit left of the middle, clear of
 * the floating + on a section's bottom edge.
 */
/** The grips' solid tints (SP-3): the spacing overlay's, strong enough to grab. */
const GRIP_TINT = { margin: "#e8913a", padding: "#5f9e45" } as const;

export const SPACING_HANDLES_CSS = `
.wf-grip {
  position: absolute;
  box-sizing: border-box;
  padding: 0;
  border: calc(1px / var(--wf-zoom, 1)) solid #fff;
  border-radius: calc(3px / var(--wf-zoom, 1));
  pointer-events: auto;
  touch-action: none;
}
.wf-grip[data-side="top"], .wf-grip[data-side="bottom"] {
  left: calc(50% - 46px / var(--wf-zoom, 1));
  width: calc(28px / var(--wf-zoom, 1));
  height: calc(6px / var(--wf-zoom, 1));
  cursor: ns-resize;
}
.wf-grip[data-side="left"], .wf-grip[data-side="right"] {
  top: calc(50% - 14px / var(--wf-zoom, 1));
  width: calc(6px / var(--wf-zoom, 1));
  height: calc(28px / var(--wf-zoom, 1));
  cursor: ew-resize;
}
.wf-grip[data-property="padding"] { background: ${GRIP_TINT.padding}; }
.wf-grip[data-property="margin"] { background: ${GRIP_TINT.margin}; }
.wf-grip[data-property="padding"][data-side="top"] { top: calc(3px / var(--wf-zoom, 1)); }
.wf-grip[data-property="padding"][data-side="bottom"] { bottom: calc(3px / var(--wf-zoom, 1)); }
.wf-grip[data-property="padding"][data-side="left"] { left: calc(3px / var(--wf-zoom, 1)); }
.wf-grip[data-property="padding"][data-side="right"] { right: calc(3px / var(--wf-zoom, 1)); }
.wf-grip[data-property="margin"][data-side="top"] { top: calc(-9px / var(--wf-zoom, 1)); }
.wf-grip[data-property="margin"][data-side="bottom"] { bottom: calc(-9px / var(--wf-zoom, 1)); }
.wf-grip-readout {
  position: absolute;
  left: 50%;
  top: 50%;
  z-index: 2;
  padding: 2px 6px;
  border-radius: 4px;
  background: #1f1f1f;
  color: #fff;
  font: 500 12px/16px system-ui, sans-serif;
  white-space: nowrap;
  pointer-events: none;
  transform: translate(-50%, -50%) scale(calc(1 / var(--wf-zoom, 1)));
}
`;

/** The side across from `side`. */
const OPPOSITE: Readonly<Record<BoxSide, BoxSide>> = {
  top: "bottom",
  bottom: "top",
  left: "right",
  right: "left",
};

/**
 * Which way a drag makes a side larger: padding grows as its grip goes in, towards the content,
 * margin as its grip goes out, away from the element.
 */
function growth(property: BoxHandleField["property"], side: BoxSide): number {
  const inward = side === "top" || side === "left" ? 1 : -1;
  return property === "padding" ? inward : -inward;
}

/** The token whose size is nearest `pixels`. */
function nearestToken(property: BoxHandleField["property"], pixels: number): SpacingToken {
  const sizes = boxTokenPixels(property);
  let best: SpacingToken = "none";
  for (const token of SPACING_TOKENS) {
    if (Math.abs(sizes[token] - pixels) < Math.abs(sizes[best] - pixels)) best = token;
  }
  return best;
}

/** `box` with `sides` set to `token`, or unset (each side's own spacing) for `undefined`. */
function withSides(
  box: BoxValue,
  sides: readonly BoxSide[],
  token: SpacingToken | undefined,
): BoxValue {
  const next: { -readonly [K in BoxSide]?: SpacingToken } = {};
  for (const side of BOX_SIDES) {
    const size = sides.includes(side) ? token : box[side];
    if (size !== undefined) next[side] = size;
  }
  return next;
}

const sameBox = (a: BoxValue, b: BoxValue) => BOX_SIDES.every((side) => a[side] === b[side]);

/** What the readout shows while a grip is dragged. */
type Readout = { readonly field: BoxHandleField; readonly side: BoxSide; readonly token: string };

/** Props of {@link SpacingHandles}. */
export type SpacingHandlesProps = {
  /** The selected element, as the canvas shows it. */
  readonly nodeId: string;
  readonly fields: readonly BoxHandleField[];
  /** The element's props now. */
  readonly props: Readonly<Record<string, unknown>> | undefined;
  /**
   * The device view the canvas shows, whose value a drag changes: as the app writes it, which a
   * custom width's frame can't be trusted to say while it resizes.
   */
  readonly breakpoint: () => Breakpoint;
  readonly onFieldDrag: (drag: FieldDrag) => void;
};

/**
 * Grips on the selected element's edges for its padding and margin (1.32, F-ED-25). Dragging one
 * sets that side to the token nearest where it is let go, shown live and as one undo step. With
 * Shift the side across changes too, with Ctrl/Cmd+Shift every side. Alt-click sets the side back
 * to the element's own spacing ("Default"). Esc cancels a drag. The grips are for the mouse; the
 * Edit panel sets the same values from the keyboard.
 */
export function SpacingHandles({
  nodeId,
  fields,
  props,
  breakpoint: shownBreakpoint,
  onFieldDrag,
}: SpacingHandlesProps) {
  const [readout, setReadout] = useState<Readout | null>(null);
  // Cancels the drag going on, if any: grips that go mid-drag (the selection or the mode changed)
  // leave no listeners behind, and no change half made.
  const cancelDrag = useRef<(() => void) | null>(null);
  useEffect(() => () => cancelDrag.current?.(), []);

  const begin = (
    event: ReactPointerEvent<HTMLButtonElement>,
    field: BoxHandleField,
    side: BoxSide,
  ) => {
    // Not a click on the element underneath: no selecting, no dragging it.
    event.stopPropagation();
    event.preventDefault();
    if (event.button !== 0 || cancelDrag.current !== null) {
      return;
    }
    const grip = event.currentTarget;
    const frame = grip.ownerDocument.defaultView;
    // Puck wraps each element in a `div` of its own: the element is its child.
    const element = grip.ownerDocument.querySelector(componentSelector(nodeId))?.firstElementChild;
    if (!frame || element === null || element === undefined) {
      return;
    }
    // The value for the device the canvas shows.
    const breakpoint = shownBreakpoint();
    const before = boxValueOf(resolveResponsive(responsiveBoxOf(props?.[field.name]), breakpoint));
    const report = (phase: FieldDrag["phase"], value: BoxValue) =>
      onFieldDrag({ phase, nodeId, field: field.name, value });

    if (event.altKey) {
      report("start", before);
      report("commit", withSides(before, [side], undefined));
      return;
    }

    const start = Number.parseFloat(
      frame.getComputedStyle(element)[`${field.property}${capital(side)}`],
    );
    const startPixels = Number.isNaN(start) ? 0 : start;
    const vertical = side === "top" || side === "bottom";
    const direction = growth(field.property, side);
    const from = vertical ? event.clientY : event.clientX;
    let current = before;
    report("start", before);
    grip.setPointerCapture(event.pointerId);

    const sidesFor = (moved: PointerEvent): readonly BoxSide[] => {
      if (moved.shiftKey && (moved.ctrlKey || moved.metaKey)) return field.sides;
      const across = OPPOSITE[side];
      return moved.shiftKey && field.sides.includes(across) ? [side, across] : [side];
    };
    const move = (moved: PointerEvent) => {
      const delta = ((vertical ? moved.clientY : moved.clientX) - from) * direction;
      const token = nearestToken(field.property, startPixels + delta);
      setReadout({ field, side, token: t(`field.spacing.${token}`) });
      const next = withSides(before, sidesFor(moved), token);
      if (!sameBox(next, current)) {
        current = next;
        report("update", next);
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
    // Esc cancels with Shift or Ctrl held too; nothing else sees it, wherever the focus is.
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
    <>
      {fields.flatMap((field) =>
        field.sides.map((side) => (
          <button
            key={`${field.name}-${side}`}
            type="button"
            tabIndex={-1}
            aria-hidden
            className="wf-grip"
            data-property={field.property}
            data-side={side}
            title={t("canvas.spacing.handle", {
              field: field.label,
              side: t(`field.side.${side}`),
            })}
            onPointerDown={(event) => begin(event, field, side)}
            onClick={(event) => event.stopPropagation()}
          />
        )),
      )}
      {readout === null ? null : (
        <span className="wf-grip-readout">
          {t("canvas.spacing.readout", {
            field: readout.field.label,
            side: t(`field.side.${readout.side}`),
            size: readout.token,
          })}
        </span>
      )}
    </>
  );
}

const capital = <T extends string>(side: T) =>
  `${side.charAt(0).toUpperCase()}${side.slice(1)}` as Capitalize<T>;
