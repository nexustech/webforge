import type { Viewport } from "@webforge/engine";
import { t } from "@webforge/i18n";
import {
  type KeyboardEvent,
  type PointerEvent,
  type RefObject,
  useEffect,
  useLayoutEffect,
  useState,
} from "react";
import { type CustomDevice, DEVICE_SIZE } from "../../shared/ipc/prefs.js";
import { clampWidth, deviceAt, snappedWidth, viewportFor } from "../shell/canvas-size.js";

/** A step of the keyboard's arrows, and with Shift, in CSS pixels. */
const KEY_STEP = { normal: 10, large: 50 } as const;

/** Where the canvas frame is in its container, in screen pixels. */
type FrameBox = { readonly left: number; readonly right: number };

/** A drag in progress: where it started, and the width it shows now. */
type Drag = {
  readonly side: "left" | "right";
  readonly startX: number;
  readonly startWidth: number;
  readonly width: number;
};

/** The canvas frame's left and right edges in `container`, if it shows one. */
function frameBox(container: HTMLElement): FrameBox | null {
  const frame = container.querySelector("iframe");
  if (frame === null) return null;
  const outer = container.getBoundingClientRect();
  const box = frame.getBoundingClientRect();
  return box.width === 0 ? null : { left: box.left - outer.left, right: box.right - outer.left };
}

/** The readout while the width changes: "768 px · Tablet". */
function readout(width: number, devices: readonly CustomDevice[]): string {
  const device = deviceAt(width, devices);
  if (device === undefined) return t("canvasResize.readout", { width });
  const name = "view" in device ? t(`device.${device.view}`) : device.name;
  return t("canvasResize.readoutDevice", { width, device: name });
}

/**
 * Handles on the canvas frame's left and right edges (F-ED-25, UX-8): drag one to set a custom
 * width, which snaps to the device widths (Alt to place it freely) and shows a live readout;
 * Escape puts it back. The frame is centred, so an edge moves half as far as the width changes.
 * As separators they also take the arrow keys. View state: never an undo step (U6).
 */
export function CanvasResizeHandles({
  container,
  width,
  zoom,
  devices,
  onChange,
}: {
  /** The canvas's container, which holds the frame. */
  readonly container: RefObject<HTMLElement | null>;
  /** The canvas width shown, in CSS pixels. */
  readonly width: number;
  /** The canvas's scale; 1 until known. */
  readonly zoom: number;
  readonly devices: readonly CustomDevice[];
  readonly onChange: (viewport: Viewport) => void;
}) {
  const [box, setBox] = useState<FrameBox | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);

  // Follows the frame as the canvas resizes, scrolls or zooms: the canvas sets its scale and width
  // in style attributes, and may put in a new frame. Measured once a frame at most.
  useLayoutEffect(() => {
    const element = container.current;
    if (element === null) return;
    let pending = 0;
    const measure = () => {
      cancelAnimationFrame(pending);
      pending = requestAnimationFrame(() => {
        const next = frameBox(element);
        setBox((current) =>
          current?.left === next?.left && current?.right === next?.right ? current : next,
        );
      });
    };
    setBox(frameBox(element));
    const resized = new ResizeObserver(measure);
    resized.observe(element);
    const changed = new MutationObserver(measure);
    changed.observe(element, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["style"],
    });
    element.addEventListener("scroll", measure, { capture: true });
    return () => {
      cancelAnimationFrame(pending);
      resized.disconnect();
      changed.disconnect();
      element.removeEventListener("scroll", measure, { capture: true });
    };
  }, [container]);

  // Escape puts the width back while dragging.
  useEffect(() => {
    if (drag === null) return;
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") setDrag(null);
    };
    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", onKeyDown, { capture: true });
  }, [drag]);

  if (box === null) return null;
  const centre = (box.left + box.right) / 2;
  const shown = drag?.width ?? width;
  const half = (shown * zoom) / 2;

  const start = (side: Drag["side"]) => (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    setDrag({ side, startX: event.clientX, startWidth: width, width });
  };
  const move = (event: PointerEvent<HTMLDivElement>) => {
    if (drag === null) return;
    const outward = (event.clientX - drag.startX) * (drag.side === "right" ? 1 : -1);
    const dragged = drag.startWidth + (outward * 2) / zoom;
    const next = event.altKey ? clampWidth(dragged) : snappedWidth(dragged, devices, zoom);
    if (next !== drag.width) setDrag({ ...drag, width: next });
  };
  const end = () => {
    if (drag === null) return;
    setDrag(null);
    if (drag.width !== width) onChange(viewportFor(drag.width));
  };
  const keys = (side: Drag["side"]) => (event: KeyboardEvent<HTMLDivElement>) => {
    const outward = side === "right" ? "ArrowRight" : "ArrowLeft";
    const inward = side === "right" ? "ArrowLeft" : "ArrowRight";
    if (event.key !== outward && event.key !== inward) return;
    event.preventDefault();
    const step = event.shiftKey ? KEY_STEP.large : KEY_STEP.normal;
    const next = clampWidth(width + (event.key === outward ? step : -step));
    if (next !== width) onChange(viewportFor(next));
  };

  const handle = (side: Drag["side"]) => (
    // biome-ignore lint/a11y/useSemanticElements: a focusable splitter; an <hr> takes no focus or keys.
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={t(side === "left" ? "canvasResize.left" : "canvasResize.right")}
      aria-valuemin={DEVICE_SIZE.min}
      aria-valuemax={DEVICE_SIZE.max}
      aria-valuenow={shown}
      aria-valuetext={readout(shown, devices)}
      tabIndex={0}
      data-side={side}
      className="canvas-resize__handle"
      style={{ left: side === "left" ? centre - half : centre + half }}
      onPointerDown={start(side)}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={() => setDrag(null)}
      onKeyDown={keys(side)}
    />
  );

  return (
    <>
      {handle("left")}
      {handle("right")}
      {drag !== null && (
        <div className="canvas-resize__readout" style={{ left: centre }} aria-hidden>
          {readout(drag.width, devices)}
        </div>
      )}
    </>
  );
}
