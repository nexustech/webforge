import type { LayoutDoc, PageDoc, Theme } from "@webforge/model";
import type { ComponentLibrary } from "@webforge/site-components";

/** Desktop · Tablet · Mobile, or a width in pixels. */
export type Viewport = "desktop" | "tablet" | "mobile" | number;

/** The canvas's size and zoom, as the canvas toolbar's readout shows them (1.15). */
export type CanvasSize = {
  /** The width of the page shown, in the page's CSS pixels: the device view's width. */
  readonly width: number;
  /** The height of the part of the page in view, in the page's CSS pixels. */
  readonly height: number;
  /** How the page is scaled on screen: 1 is its real size, 0.5 half of it. */
  readonly zoom: number;
};

/** Design mode edits everything; Content mode only text and images (M3). */
export type EditorMode = "design" | "content";

/** Stops a subscription. */
export type Unsubscribe = () => void;

/** A document change from outside the engine (undo, redo, jump) to show on the canvas. */
export type DocChange = {
  readonly page: PageDoc;
};

/** What kind of edit the user made on the canvas; drives the undo label (D2). */
export type EngineEditKind =
  | "insert"
  | "move"
  | "remove"
  | "duplicate"
  | "text"
  | "props"
  | "root"
  /** A change the engine made that matches no user action; recorded so nothing drifts. */
  | "page";

/**
 * The whole of an edit that set one field of one element to a plain value (text, number, boolean
 * or `null`), such as a keystroke or a select field. The app can record just this instead of
 * comparing the whole page (ADR 0007).
 */
export type EnginePatch = {
  readonly nodeId: string;
  readonly field: string;
  readonly value: string | number | boolean | null;
};

/**
 * An edit the user made on the canvas. The engine has already applied it to its own view; the app
 * records it in the history and the document store, which then becomes the source of truth.
 */
export type EngineEdit = {
  readonly kind: EngineEditKind;
  /** The element or section that changed, or `null` for the page itself. */
  readonly nodeId: string | null;
  /** Its component type, e.g. "Heading". */
  readonly componentType: string | null;
  /** The changed field for `text` and `props` edits. */
  readonly field: string | null;
  /** The whole page after the edit. */
  readonly page: PageDoc;
  /** Set when the edit changed nothing but one field of one element to a plain value. */
  readonly patch?: EnginePatch;
  /** The selection after the edit. */
  readonly selection: string | null;
};

/**
 * History commands from the keyboard: undo, redo, and `cancel` (Esc), which cancels a gesture in
 * progress such as a slider drag (U2).
 */
export type HistoryCommand = "undo" | "redo" | "cancel";

/**
 * Runs a history command. Returns true if it did something with it: an Esc that cancelled
 * nothing is left to the rest of the page (closing a menu, deselecting).
 */
export type HistoryCommandHandler = (command: HistoryCommand) => boolean | undefined | void;

/**
 * What the user can do to the selected element from the keyboard (1.12): select the element
 * before or after it in the page, move it within its list, duplicate it or delete it.
 */
export type CanvasAction =
  | "selectPrevious"
  | "selectNext"
  | "moveUp"
  | "moveDown"
  | "duplicate"
  | "delete";

/** Where the floating + asks to add a section: a position in the page's top-level list. */
export type InsertPoint = { readonly index: number };

/** Options of {@link CanvasEngine.mount}. */
export type MountOptions = {
  readonly library: ComponentLibrary;
  readonly theme: Theme;
};

/**
 * The canvas: shows one page, lets the user arrange and edit it, and reports every edit. Webforge
 * owns the document and its history; the engine never keeps its own undo stack (decision C6,
 * architecture §6). Puck is one implementation; an own canvas would be another.
 */
export interface CanvasEngine {
  mount(el: HTMLElement, opts: MountOptions): void;
  loadPage(page: PageDoc, layout: LayoutDoc): void;
  /** Shows a change made outside the engine, e.g. by undo. Keeps the selection if it still exists. */
  applyChange(change: DocChange): void;
  onUserEdit(cb: (edit: EngineEdit) => void): Unsubscribe;
  select(nodeId: string | null): void;
  onSelectionChange(cb: (nodeId: string | null) => void): Unsubscribe;
  /** Undo/redo shortcuts and Esc pressed inside the canvas (U4). */
  onHistoryCommand(cb: HistoryCommandHandler): Unsubscribe;
  setViewport(v: Viewport): void;
  /**
   * The user switched the canvas to another device view with the canvas's own controls. A view
   * change is not a history step (U6). Not called for {@link setViewport}.
   */
  onViewportChange(cb: (viewport: Viewport) => void): Unsubscribe;
  /**
   * Scales the canvas (1.15): a factor (1 is real size), or `"fit"` to fit the device view's width
   * into the space the canvas has. The canvas starts fitted, and fits again whenever that space or
   * the view changes. Before the canvas is ready, this does nothing.
   */
  setZoom(zoom: number | "fit"): void;
  /** Reports the canvas's size and zoom now, if known, and whenever any of them changes. */
  onCanvasSize(cb: (size: CanvasSize) => void): Unsubscribe;
  /**
   * Styles the canvas with the site's own compiled CSS and the classes exported pages put on
   * `<body>`, so the page looks as it will when exported (1.12). Replaces the previous styles.
   */
  setSiteCss(css: string, bodyClass: string): void;
  setMode(mode: EditorMode): void;
  /**
   * Does `action` to the selected element. Edits are reported through {@link onUserEdit} as one
   * step each, like the same action done with the mouse. Returns false if there is nothing to do:
   * no selection, the end of the list, or an action Content mode doesn't allow.
   */
  perform(action: CanvasAction): boolean;
  /** The floating + between sections was clicked; the app decides what to add there. */
  onAddRequest(cb: (at: InsertPoint) => void): Unsubscribe;
  /**
   * The canvas iframe's window whenever it changes (`null` when it goes), so the app can handle its
   * keyboard shortcuts there too.
   */
  onFrameWindow(cb: (frameWindow: Window | null) => void): Unsubscribe;
  renderStatic(page: PageDoc, layout: LayoutDoc): string;
  destroy(): void;
}
