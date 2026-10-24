import type { Viewport } from "@webforge/engine";
import type { EditPreviews } from "@webforge/site-components";
import { createStore, type StoreApi } from "zustand/vanilla";
import { widthOf } from "../shell/canvas-size.js";

/** The edit-only previews the user turned on (UX-26): view state, never an undo step (U6). */
export type PreviewChoices = {
  /** *Show mobile menu*: the Header's small-screen menu shown open. */
  readonly mobileMenu: boolean;
  /** *Show column outlines*: each Column's edges outlined (2.17). */
  readonly columnOutlines: boolean;
};

/**
 * A window's preview choices: the mobile menu closed, as a site opens, and column outlines shown,
 * so columns can be told apart while they're being laid out.
 */
export function createPreviewStore(): StoreApi<PreviewChoices> {
  return createStore<PreviewChoices>()(() => ({ mobileMenu: false, columnOutlines: true }));
}

/** The width from which sites show their wide-screen layout: Tailwind's `md` breakpoint. */
const WIDE_SCREENS_FROM = 768;

/** Whether the canvas at `viewport` shows the site as small screens do: its menu behind a button. */
export function showsSmallScreens(viewport: Viewport): boolean {
  return widthOf(viewport) < WIDE_SCREENS_FROM;
}

/** What the canvas previews at `viewport`: the mobile menu only where the site has one. */
export function canvasPreviews(choices: PreviewChoices, viewport: Viewport): EditPreviews {
  return {
    mobileMenu: choices.mobileMenu && showsSmallScreens(viewport),
    columnOutlines: choices.columnOutlines,
  };
}
