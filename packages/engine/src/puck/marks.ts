import type { DropMark } from "../canvas-engine.js";
import { COMPONENT, componentSelector, elementOf } from "./puck-dom.js";
import { ensureStyle } from "./styles.js";

/**
 * Marks drawn on the canvas for something outside it: the name chip of an element outlined from a
 * Layers row or a breadcrumb (SP-10), and where a layer dragged in Layers would land (SP-8). They
 * sit in a layer of their own over the page, in the editor's accent as the element bar is (LF-3),
 * the same size on screen whatever the zoom, and take no clicks.
 */

/** How tall a chip is on screen, in pixels: it sits that far above its element. */
const CHIP_HEIGHT = 18;

const MARKS_STYLE_ATTRIBUTE = "data-wf-marks";

const MARKS_CSS = `
.wf-mark-chip {
  position: absolute;
  height: ${CHIP_HEIGHT}px;
  padding: 2px 6px;
  box-sizing: border-box;
  border-radius: 3px;
  background: var(--wf-primary, #0a6fb7);
  color: var(--wf-primary-foreground, #fff);
  font: 600 11px/14px system-ui, sans-serif;
  white-space: nowrap;
  pointer-events: none;
  z-index: 2147483001;
  transform: scale(calc(1 / var(--wf-zoom, 1)));
  transform-origin: left top;
}
.wf-mark-line {
  position: absolute;
  background: var(--wf-primary, #0a6fb7);
  pointer-events: none;
  z-index: 2147483001;
}
`;

/** What a mark is for: each kind is drawn and taken away on its own. */
type MarkKind = "outline" | "drop";

/** Takes the marks of `kind` off the canvas `doc`. */
function clear(doc: Document, kind: MarkKind): void {
  for (const mark of doc.querySelectorAll(`[data-wf-mark="${kind}"]`)) mark.remove();
}

/** A new mark of `kind` in `doc`'s page, with `className`; its position is the caller's. */
function addMark(doc: Document, kind: MarkKind, className: string): HTMLElement {
  ensureStyle(doc, MARKS_STYLE_ATTRIBUTE, MARKS_CSS);
  const mark = doc.createElement("div");
  mark.className = className;
  mark.setAttribute("data-wf-mark", kind);
  mark.setAttribute("aria-hidden", "true");
  doc.body.append(mark);
  return mark;
}

/** The box element `nodeId` draws on the page, or its wrapper's where it draws none. */
function boxOf(doc: Document, nodeId: string): DOMRect | undefined {
  const element = elementOf(doc, nodeId) ?? doc.querySelector(componentSelector(nodeId));
  return element?.getBoundingClientRect();
}

/**
 * A chip naming `name` at (`left`, `top`) in the viewport, `zoom` being the canvas's scale: above
 * that point, or just below it where there is no room above (the top of the page).
 */
function addChip(
  doc: Document,
  kind: MarkKind,
  name: string,
  left: number,
  top: number,
  zoom: number,
): void {
  const view = doc.defaultView;
  const chip = addMark(doc, kind, "wf-mark-chip");
  chip.textContent = name;
  const above = CHIP_HEIGHT / zoom;
  const pageTop = top + (view?.scrollY ?? 0);
  chip.style.left = `${left + (view?.scrollX ?? 0)}px`;
  chip.style.top = `${pageTop >= above ? pageTop - above : pageTop}px`;
}

/**
 * Names the outlined element `nodeId` in a chip above its top-left corner, as its bar names a
 * hovered one (SP-10); `null`, or no name, takes the chip away.
 */
export function showOutlineChip(
  doc: Document | undefined,
  nodeId: string | null,
  name: string | undefined,
  zoom: number,
): void {
  if (doc === undefined) return;
  clear(doc, "outline");
  if (nodeId === null || name === undefined) return;
  const box = boxOf(doc, nodeId);
  if (box === undefined) return;
  addChip(doc, "outline", name, box.left, box.top, zoom);
}

/**
 * Whether element `nodeId` sits beside a sibling rather than above or below it (a Columns'
 * column): its drop line is then upright, at its left or right edge.
 */
function besideSiblings(doc: Document, nodeId: string, box: DOMRect): boolean {
  const wrapper = doc.querySelector(componentSelector(nodeId));
  const siblings = [wrapper?.previousElementSibling, wrapper?.nextElementSibling];
  return siblings.some((sibling) => {
    if (sibling === null || sibling === undefined || !sibling.matches(COMPONENT)) return false;
    const other = sibling.getBoundingClientRect();
    return other.top < box.bottom && other.bottom > box.top;
  });
}

/**
 * Marks where a layer dragged in Layers would land (SP-8): a 1 px line in the accent along the
 * edge of element `mark.nodeId` it would go before or after, with the dragged element's chip at
 * the start of the line. `null` takes the mark away.
 */
export function showDropMark(doc: Document | undefined, mark: DropMark | null, zoom: number): void {
  if (doc === undefined) return;
  clear(doc, "drop");
  if (mark === null) return;
  const box = boxOf(doc, mark.nodeId);
  const view = doc.defaultView;
  if (box === undefined || view === null) return;
  const thickness = 1 / zoom;
  const line = addMark(doc, "drop", "wf-mark-line");
  const upright = besideSiblings(doc, mark.nodeId, box);
  const after = mark.place === "after";
  // The line's start, in the viewport: where the chip goes too.
  const left = upright && after ? box.right - thickness : box.left;
  const top = !upright && after ? box.bottom - thickness : box.top;
  line.style.left = `${left + view.scrollX}px`;
  line.style.top = `${top + view.scrollY}px`;
  line.style.width = `${upright ? thickness : box.width}px`;
  line.style.height = `${upright ? box.height : thickness}px`;
  addChip(doc, "drop", mark.name, left, top, zoom);
}
