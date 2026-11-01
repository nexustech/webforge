/**
 * Puck's DOM contract (R8, ADR 0004): each selector and private API of Puck's that the engine
 * relies on, named here and nowhere else. Puck's class names are CSS-module hashes that keep their
 * readable part (`_PuckCanvas-root_1a2b3`), matched by that part; its data attributes are its
 * markup. `puck-dom.test.tsx` mounts Puck and checks that each one still matches, so a Puck upgrade
 * that changes them fails `pnpm check` before the E2E suite does.
 *
 * React-free, so the E2E tests and the canvas styles worker import it too, as
 * `@webforge/engine/puck-dom` (A20).
 */

import { HIDDEN_ATTRIBUTE } from "@webforge/model";

/** The attribute on each component's wrapper on the canvas, which holds the element's id. */
export const COMPONENT_ATTRIBUTE = "data-puck-component";

/** The class the canvas gives the page's drop zone, its list of sections (config.tsx). */
export const SECTIONS_ZONE_CLASS = "wf-sections";

/**
 * Every second section of the canvas that a visitor would see (2.13d, A19), for the canvas's CSS
 * (`themeCss`'s `evenSections`): each section is in a wrapper of Puck's in the page's drop zone,
 * and only wrappers of a shown section count, never one hidden in Layers (which the export leaves
 * out) or Puck's place for a dragged one.
 */
export const CANVAS_EVEN_SECTIONS = `.${SECTIONS_ZONE_CLASS} > :nth-child(even of :has(> section:not([${HIDDEN_ATTRIBUTE}]))) > section`;

/** Any component's wrapper on the canvas. */
export const COMPONENT = `[${COMPONENT_ATTRIBUTE}]`;

/** The wrapper of the element `id` on the canvas. */
export function componentSelector(id: string): string {
  return `[${COMPONENT_ATTRIBUTE}="${CSS.escape(id)}"]`;
}

/**
 * The element node `id` draws: Puck wraps each element in a `div` of its own, which can be wider
 * than the element (a Small Image in a wide column).
 */
export function elementOf(document: Document, id: string): Element | null | undefined {
  return document.querySelector(componentSelector(id))?.firstElementChild;
}

/** Puck's overlay over a component on the canvas, which holds its outline and action bar. */
export const OVERLAY = "[data-puck-overlay]";

/** An item of Puck's drawer: the Add panel's drag sources are drawn as these. */
export const DRAWER_ITEM = "[data-puck-drawer-item]";

/** The page's own drop zone, which holds its top-level elements. */
export const ROOT_DROP_ZONE = '[data-puck-dropzone="root:default-zone"]';

/** A rich-text editor (Tiptap's ProseMirror) on the canvas. */
export const RICH_TEXT = ".ProseMirror";

/** An inline text field on the canvas: a Heading's or a Button's text, edited where it is. */
export const INLINE_TEXT = '[class*="_InlineTextField_"]';

/** Puck's canvas root, whose style carries the canvas zoom (its scale and height). */
export const CANVAS_ROOT = '[class*="PuckCanvas-root"]';

/** The box Puck fits the canvas into: its content box is the room the page has (PH2-18). */
export const CANVAS_INNER = '[class*="PuckCanvas-inner"]';

/** Puck's scrolling canvas area around the canvas root (LF-2: its padding and background). */
export const CANVAS = '[class*="_PuckCanvas_"]';

/**
 * Puck's box around a component's action bar, which it places with inline styles, and the sticky
 * layer that holds it, shown only for the selected component (LF-3, SP-1).
 */
export const ACTIONS = '[class*="_DraggableComponent-actions_"]';
export const ACTIONS_OVERLAY = '[class*="_DraggableComponent-actionsOverlay_"]';

/** The component under the pointer, and the selected one, as Puck marks them. */
export const HOVERED_COMPONENT = '[class*="_DraggableComponent--hover_"]';
export const SELECTED_COMPONENT = '[class*="_DraggableComponent--isSelected_"]';

/**
 * A component's action bar (the chip with its name and its actions), its name, and one action,
 * named by its title ("Delete").
 */
export const ACTION_BAR = '[class*="_ActionBar_"]';
export const ACTION_BAR_LABEL = '[class*="_ActionBar-label_"]';
export const ACTION_BAR_ACTION = '[class*="_ActionBarAction_"]';

/** The rich-text editor's formatting menu, which Puck draws over the text being edited. */
export const RICH_TEXT_MENU = "[data-puck-rte-menu]";

/**
 * While a drag goes on (A20): the entry Puck draws for the element being dragged, and where it
 * would drop, dnd-kit's placeholder or Puck's line. They show only during a pointer drag, which
 * happy-dom can't make, so `puck-dom.test.tsx` checks that Puck still names them, and the E2E
 * drags use them.
 */
export const DRAGGING = "[data-puck-entry][data-puck-dragging]";
export const DROP_PREVIEW = "[data-dnd-placeholder], [data-puck-line-placeholder]";

/** The attribute Puck gives a component's wrapper that can't be dragged now, as it is drawn again. */
export const DISABLED_ATTRIBUTE = "data-puck-disabled";

/** Puck's layout around the canvas (#274): its plugin rail, its two sidebars and their box. */
export const LAYOUT = {
  nav: '[class*="_PuckLayout-nav_"]',
  inner: '[class*="_PuckLayout-inner_"]',
  leftSidebar: '[class*="_Sidebar--left_"]',
  rightSidebar: '[class*="_Sidebar--right_"]',
} as const;

/** Puck's canvas zoom (`zoomConfig`), which its public API leaves out. */
export type ZoomConfig = {
  readonly zoom: number;
  readonly autoZoom: number;
  readonly rootHeight: number;
};

/**
 * What our Puck patch (see `pnpm-workspace.yaml`) adds to Puck's API object as `__private`: the
 * canvas zoom, and sending the change a rich-text editor still holds back.
 */
export type PuckPrivateApi = {
  /** Sends the focused rich-text editor's pending change; true if there was one. */
  readonly flushRichText: () => boolean;
  readonly getZoomConfig: () => ZoomConfig;
  readonly setZoomConfig: (zoomConfig: ZoomConfig) => void;
};

/**
 * The private API our patch adds to Puck's API object `puck` (from `useGetPuck`), or undefined if
 * any of it is missing, as after a Puck upgrade without the patch: the zoom and the flush then do
 * nothing, and `puck-dom.test.tsx` fails.
 */
export function puckPrivateApi(puck: unknown): PuckPrivateApi | undefined {
  const internal = (puck as { readonly __private?: Partial<PuckPrivateApi> } | null)?.__private;
  const flushRichText = internal?.flushRichText;
  const getZoomConfig = internal?.getZoomConfig;
  const setZoomConfig = internal?.setZoomConfig;
  return flushRichText === undefined || getZoomConfig === undefined || setZoomConfig === undefined
    ? undefined
    : { flushRichText, getZoomConfig, setZoomConfig };
}
