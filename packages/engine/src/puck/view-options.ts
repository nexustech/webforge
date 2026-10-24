import type { ViewOptions } from "../canvas-engine.js";
import { canvasZoom } from "./chrome.js";
import { COMPONENT, COMPONENT_ATTRIBUTE, OVERLAY, ROOT_DROP_ZONE } from "./puck-dom.js";
import { ensureStyle } from "./styles.js";

/**
 * The canvas's View options (F-ED-25, UX-7): outlines around every element, an element's margins
 * and padding on hover, element names, and room below the page. They only change what the canvas
 * shows; the page, its export and its history stay as they are. Drawn in the canvas document,
 * which has none of the editor's styles, so the styles here are self-contained; line widths and
 * labels are divided by the canvas zoom so they keep their size on screen.
 */

const VIEW_STYLE_ATTRIBUTE = "data-webforge-view-css";

/** The attribute on the canvas document's root for each option that is on. */
const OPTION_ATTRIBUTES: Record<keyof ViewOptions, string> = {
  outlines: "data-wf-view-outlines",
  spacingOnHover: "data-wf-view-spacing",
  elementNames: "data-wf-view-names",
  extraBottomSpace: "data-wf-view-extra-space",
};

/** Puck's wrapper around each element on the canvas. */
const ELEMENT = COMPONENT;

/** The room *Extra space at the bottom* leaves below the page's last section, in CSS pixels. */
const EXTRA_SPACE = 320;

/** How tall a name label is on screen, in pixels: it sits that far above its element. */
const NAME_HEIGHT = 16;

const VIEW_CSS = `
/* Show outlines: a thin dashed line around every element, in the chrome's magenta. */
[${OPTION_ATTRIBUTES.outlines}] ${ELEMENT} {
  outline: calc(1px / var(--wf-view-zoom, 1)) dashed rgba(240, 40, 243, 0.45);
  outline-offset: calc(-1px / var(--wf-view-zoom, 1));
}
/*
 * Extra space at the bottom: room below the page's last section to drop into. The page's zone
 * fills the canvas (100%), where padding would add nothing: it grows with its content instead,
 * at least the canvas's height, plus a fixed room (not vh, which would grow with the page).
 */
[${OPTION_ATTRIBUTES.extraBottomSpace}] ${ROOT_DROP_ZONE} {
  height: auto;
  min-height: 100vh;
  padding-bottom: ${EXTRA_SPACE}px;
}
.wf-view-layer {
  position: absolute;
  top: 0;
  left: 0;
  width: 0;
  height: 0;
  pointer-events: none;
  z-index: 2147483000;
}
.wf-view-name {
  position: absolute;
  height: ${NAME_HEIGHT}px;
  padding: 1px 4px;
  box-sizing: border-box;
  border-radius: 2px;
  background: rgba(240, 40, 243, 0.85);
  color: #fff;
  font: 500 11px/14px system-ui, sans-serif;
  white-space: nowrap;
  transform: scale(calc(1 / var(--wf-view-zoom, 1)));
  transform-origin: left top;
}
.wf-view-margin,
.wf-view-padding {
  position: absolute;
  box-sizing: border-box;
  border-style: solid;
}
/* As browsers' developer tools colour them: margins orange, padding green. */
.wf-view-margin {
  border-color: rgba(246, 178, 107, 0.55);
}
.wf-view-padding {
  border-color: rgba(147, 196, 125, 0.55);
}
`;

/** A box on the page, in document coordinates, and the width of the band on each side. */
type Band = {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
  /** Top, right, bottom, left. */
  readonly sides: readonly [number, number, number, number];
};

const px = (value: string) => Number.parseFloat(value) || 0;

/** A computed style's four sides ("margin-top", "border-top-width"…), top first. */
function sidesOf(
  style: CSSStyleDeclaration,
  prefix: string,
  suffix = "",
): readonly [number, number, number, number] {
  const side = (name: string) => px(style.getPropertyValue(`${prefix}-${name}${suffix}`));
  return [side("top"), side("right"), side("bottom"), side("left")];
}

/** `element`'s margin and padding bands, in its document's coordinates. */
function bandsOf(element: Element, view: Window): { margin: Band; padding: Band } {
  const box = element.getBoundingClientRect();
  const style = view.getComputedStyle(element);
  const x = box.left + view.scrollX;
  const y = box.top + view.scrollY;
  const [mt, mr, mb, ml] = sidesOf(style, "margin");
  const [bt, br, bb, bl] = sidesOf(style, "border", "-width");
  return {
    margin: {
      left: x - ml,
      top: y - mt,
      width: box.width + ml + mr,
      height: box.height + mt + mb,
      sides: [mt, mr, mb, ml],
    },
    padding: {
      left: x + bl,
      top: y + bt,
      width: Math.max(0, box.width - bl - br),
      height: Math.max(0, box.height - bt - bb),
      sides: sidesOf(style, "padding"),
    },
  };
}

/** Places `element` over `band`, its border drawing the band's sides. */
function place(element: HTMLElement, band: Band): void {
  element.style.left = `${band.left}px`;
  element.style.top = `${band.top}px`;
  element.style.width = `${band.width}px`;
  element.style.height = `${band.height}px`;
  element.style.borderWidth = band.sides.map((side) => `${side}px`).join(" ");
}

/**
 * Calls `onChange` (once for each batch of changes) when the page in `document` changes in a way
 * that can move its elements: content, text, and the attributes that lay them out. Not `layer`'s own
 * changes, nor Puck's overlays, which follow every pointer move and scroll, nor the hover and
 * drag state Puck and dnd-kit keep in data- and aria- attributes. Returns a function that stops.
 */
function watchPage(document: Document, layer: HTMLElement, onChange: () => void): () => void {
  const changed = new MutationObserver((records) => {
    const moved = records.some((record) => {
      // Nodes from the canvas document: not this realm's `Element`.
      const node = record.target;
      const element = node.nodeType === 1 ? (node as Element) : node.parentElement;
      return !layer.contains(node) && (element?.closest(OVERLAY) ?? null) === null;
    });
    if (moved) onChange();
  });
  changed.observe(document.body, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: ["style", "class", "hidden"],
  });
  return () => changed.disconnect();
}

/**
 * Draws the hovered element's margin and padding in `layer`, following it as the page changes
 * under a still pointer (a drag, an undo, an Edit panel change). Returns a function that stops.
 */
function showSpacingOnHover(document: Document, view: Window, layer: HTMLElement): () => void {
  const margin = document.createElement("div");
  margin.className = "wf-view-margin";
  const padding = document.createElement("div");
  padding.className = "wf-view-padding";
  let hovered: Element | null = null;
  const show = () => {
    // An element taken off the page (deleted, undone) shows nothing.
    if (hovered?.isConnected === false) hovered = null;
    // The element's own markup, inside Puck's wrapper.
    const shown = hovered?.firstElementChild ?? hovered;
    if (shown === null) {
      margin.remove();
      padding.remove();
      return;
    }
    const bands = bandsOf(shown, view);
    place(margin, bands.margin);
    place(padding, bands.padding);
    layer.append(margin, padding);
  };
  const onMove = (event: Event) => {
    const target = event.target;
    // Nodes from the canvas document: not this realm's `Element`.
    const next =
      target !== null && typeof (target as Element).closest === "function"
        ? (target as Element).closest(ELEMENT)
        : null;
    if (next !== hovered) {
      hovered = next;
      show();
    }
  };
  const onLeave = () => {
    hovered = null;
    show();
  };
  document.addEventListener("pointermove", onMove);
  document.documentElement.addEventListener("pointerleave", onLeave);
  // The canvas moving the element under a still pointer: scrolled, or resized (another device).
  view.addEventListener("scroll", show);
  view.addEventListener("resize", show);
  const stopWatching = watchPage(document, layer, show);
  return () => {
    stopWatching();
    document.removeEventListener("pointermove", onMove);
    document.documentElement.removeEventListener("pointerleave", onLeave);
    view.removeEventListener("scroll", show);
    view.removeEventListener("resize", show);
  };
}

/**
 * Names every element in `layer`, above its top-left corner (just inside it at the top of the
 * page), but the selected one: its own bar names it. Kept in place as the page changes. Returns a
 * function that stops.
 */
function showElementNames(
  document: Document,
  view: Window,
  layer: HTMLElement,
  nameOf: (id: string) => string | undefined,
  zoomed: () => void,
): () => void {
  let pending = 0;
  const draw = () => {
    cancelAnimationFrame(pending);
    pending = requestAnimationFrame(() => {
      zoomed();
      const above = NAME_HEIGHT / canvasZoom(document.documentElement);
      // Looked up once a draw: its own bar names the selected element.
      const selected = document
        .querySelector('.wf-outline[data-state="selected"]')
        ?.getAttribute("data-wf-id");
      const labels: HTMLElement[] = [];
      for (const element of document.querySelectorAll<HTMLElement>(ELEMENT)) {
        const id = element.getAttribute(COMPONENT_ATTRIBUTE) ?? "";
        const name = nameOf(id);
        const box = element.getBoundingClientRect();
        if (name === undefined || id === selected || box.width === 0) continue;
        const label = document.createElement("span");
        label.className = "wf-view-name";
        label.textContent = name;
        const top = box.top + view.scrollY;
        label.style.left = `${box.left + view.scrollX}px`;
        label.style.top = `${top >= above ? top - above : top}px`;
        labels.push(label);
      }
      for (const label of layer.querySelectorAll(".wf-view-name")) label.remove();
      layer.append(...labels);
    });
  };
  draw();
  const stopWatching = watchPage(document, layer, draw);
  view.addEventListener("resize", draw);
  return () => {
    cancelAnimationFrame(pending);
    stopWatching();
    view.removeEventListener("resize", draw);
  };
}

/**
 * Shows the View `options` in the canvas `document`, naming elements with `nameOf` (by Puck's id
 * for them). Returns a function that takes them all away again.
 */
export function applyViewOptions(
  document: Document,
  options: ViewOptions,
  nameOf: (id: string) => string | undefined,
): () => void {
  const view = document.defaultView;
  const root = document.documentElement;
  if (view === null) return () => undefined;
  ensureStyle(document, VIEW_STYLE_ATTRIBUTE, VIEW_CSS);
  for (const [option, attribute] of Object.entries(OPTION_ATTRIBUTES)) {
    root.toggleAttribute(attribute, options[option as keyof ViewOptions]);
  }
  const zoomed = () => root.style.setProperty("--wf-view-zoom", String(canvasZoom(root)));
  zoomed();
  const layer = document.createElement("div");
  layer.className = "wf-view-layer";
  layer.setAttribute("aria-hidden", "true");
  document.body.append(layer);
  const stops = [
    options.spacingOnHover ? showSpacingOnHover(document, view, layer) : undefined,
    options.elementNames ? showElementNames(document, view, layer, nameOf, zoomed) : undefined,
  ];
  return () => {
    for (const stop of stops) stop?.();
    layer.remove();
    for (const attribute of Object.values(OPTION_ATTRIBUTES)) root.removeAttribute(attribute);
  };
}
