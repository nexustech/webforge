import type { ScreenBox } from "@webforge/editor-ui";
import { COMMAND_IDS } from "../shell/command-ids.js";

/** A step of the tour (OB-2): what it says, its help page, and what it points at. */
export type TourStep = {
  readonly id: "words" | "preview" | "publish" | "help";
  /** The help page *Learn more* opens (5.4b), if any. */
  readonly helpPage?: string;
  /** Where its control is on screen now; null while it isn't there. Centred without one. */
  readonly anchor?: (document: Document) => ScreenBox | null;
};

/** The box of `element` in its own window, or null without one or while it isn't drawn. */
const boxOf = (element: Element | null): ScreenBox | null => {
  if (element === null) return null;
  const box = element.getBoundingClientRect();
  return box.width > 0 && box.height > 0 ? box : null;
};

/**
 * The first heading on the page in the canvas, as a box in the editor's window: the canvas's
 * frame is scaled by its zoom, so the heading's box is scaled and moved by the frame's place.
 */
export function firstHeadingOnPage(document: Document): ScreenBox | null {
  const frame = document.querySelector<HTMLIFrameElement>(".editor__canvas iframe");
  const heading = frame?.contentDocument?.querySelector("h1, h2, h3") ?? null;
  const inside = boxOf(heading);
  if (frame === null || frame === undefined || inside === null) return null;
  const outer = frame.getBoundingClientRect();
  const scale = frame.offsetWidth > 0 ? outer.width / frame.offsetWidth : 1;
  const box = {
    left: outer.left + inside.left * scale,
    top: outer.top + inside.top * scale,
    width: inside.width * scale,
    height: inside.height * scale,
  };
  // Scrolled out of the canvas: not where the person can see it.
  const shown =
    box.top + box.height > outer.top &&
    box.top < outer.top + outer.height &&
    box.left + box.width > outer.left &&
    box.left < outer.left + outer.width;
  return shown ? box : null;
}

/** The title bar's button for command `id` (`CommandButton`'s `data-command`). */
const commandButton = (id: string) => (document: Document) =>
  boxOf(document.querySelector(`[data-command="${id}"]`));

/**
 * The tour (OB-2, QS-8): change your words, see it as visitors will, put it online; then where
 * help is.
 */
export const TOUR_STEPS: readonly TourStep[] = [
  { id: "words", helpPage: "editing-on-the-page", anchor: firstHeadingOnPage },
  { id: "preview", helpPage: "preview", anchor: commandButton(COMMAND_IDS.preview) },
  { id: "publish", helpPage: "publish", anchor: commandButton(COMMAND_IDS.publish) },
  { id: "help" },
];

/** How many of the tour's steps are numbered: the last card, on help, isn't one. */
export const NUMBERED_STEPS = TOUR_STEPS.filter((step) => step.anchor !== undefined).length;
