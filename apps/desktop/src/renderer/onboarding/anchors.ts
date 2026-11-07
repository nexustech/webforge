import type { ScreenBox } from "@webforge/editor-ui";
import { elementOf } from "@webforge/engine/puck-dom";

/** The box of `element` in its own window, or null without one or while it isn't drawn. */
export const boxOf = (element: Element | null | undefined): ScreenBox | null => {
  if (element === null || element === undefined) return null;
  const box = element.getBoundingClientRect();
  return box.width > 0 && box.height > 0 ? box : null;
};

/**
 * The box of what `find` finds on the page in the canvas, in the editor's window: the canvas's
 * frame is scaled by its zoom, so the box is scaled and moved by the frame's place. Null while it
 * isn't there, or is scrolled out of the canvas.
 */
export function onCanvas(
  document: Document,
  find: (page: Document) => Element | null | undefined,
): ScreenBox | null {
  const frame = document.querySelector<HTMLIFrameElement>(".editor__canvas iframe");
  const page = frame?.contentDocument;
  const inside = page === null || page === undefined ? null : boxOf(find(page));
  if (frame === null || inside === null) return null;
  const outer = frame.getBoundingClientRect();
  const scale = frame.offsetWidth > 0 ? outer.width / frame.offsetWidth : 1;
  const box = {
    left: outer.left + inside.left * scale,
    top: outer.top + inside.top * scale,
    width: inside.width * scale,
    height: inside.height * scale,
  };
  const shown =
    box.top + box.height > outer.top &&
    box.top < outer.top + outer.height &&
    box.left + box.width > outer.left &&
    box.left < outer.left + outer.width;
  return shown ? box : null;
}

/** The first heading on the page in the canvas. */
export const firstHeadingOnPage = (document: Document) =>
  onCanvas(document, (page) => page.querySelector("h1, h2, h3"));

/** Element `nodeId` on the page in the canvas. */
export const elementOnPage = (document: Document, nodeId: string) =>
  onCanvas(document, (page) => elementOf(page, nodeId));

/** The first element in the window matching `selector`. */
export const inWindow = (document: Document, selector: string) =>
  boxOf(document.querySelector(selector));
