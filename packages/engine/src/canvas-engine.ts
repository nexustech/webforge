import type { LayoutDoc, PageDoc, Theme } from "@webforge/model";
import type { ComponentLibrary } from "@webforge/site-components";

/** Desktop · Tablet · Mobile, or a width in pixels. */
export type Viewport = "desktop" | "tablet" | "mobile" | number;

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
  setMode(mode: EditorMode): void;
  renderStatic(page: PageDoc, layout: LayoutDoc): string;
  destroy(): void;
}
