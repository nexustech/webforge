import type { ScreenBox } from "@webforge/editor-ui";
import { COMMAND_IDS } from "../shell/command-ids.js";
import { firstHeadingOnPage, inWindow } from "./anchors.js";

/** A step of the tour (OB-2): what it says, its help page, and what it points at. */
export type TourStep = {
  readonly id: "words" | "preview" | "publish" | "help";
  /** The help page *Learn more* opens (5.4b), if any. */
  readonly helpPage?: string;
  /** Where its control is on screen now; null while it isn't there. Centred without one. */
  readonly anchor?: (document: Document) => ScreenBox | null;
};

/** The title bar's button for command `id` (`CommandButton`'s `data-command`). */
const commandButton = (id: string) => (document: Document) =>
  inWindow(document, `[data-command="${id}"]`);

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
