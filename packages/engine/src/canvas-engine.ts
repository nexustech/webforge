import type {
  LayoutDoc,
  NodeDoc,
  PageDoc,
  RichTextLink,
  SharedSectionId,
  SharedSectionsDoc,
  Theme,
} from "@webforge/model";
import type { ComponentLibrary, RenderContext, ResolvedImage } from "@webforge/site-components";
import type { ComponentType, ReactNode } from "react";

/** The rich-text field being edited on the canvas: its element and the field's name. */
export type RichTextAt = { readonly nodeId: string; readonly field: string };

/**
 * Asks the app for a link in rich text (F-ED-18), starting from `current`, the link at the caret if
 * there is one, in the field being edited (`at`, when known): resolves to the new link, `null` to
 * remove it, or `undefined` to leave it as it is.
 */
export type LinkPicker = (
  current: RichTextLink | null,
  at: RichTextAt | null,
) => Promise<RichTextLink | null | undefined>;

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

/**
 * What the canvas shows besides the page (F-ED-25, the View menu): outlines around every element,
 * an element's margins and padding on hover, element names, and room below the page. They change
 * only what the canvas shows: never the page, its export or its history.
 */
export type ViewOptions = {
  readonly outlines: boolean;
  readonly spacingOnHover: boolean;
  readonly elementNames: boolean;
  readonly extraBottomSpace: boolean;
};

/** Stops a subscription. */
export type Unsubscribe = () => void;

/** A document change from outside the engine (undo, redo, jump) to show on the canvas. */
export type DocChange = {
  readonly page: PageDoc;
  /** The shared Header and Footer shown around it (F-ED-7); left as they are if left out. */
  readonly layout?: LayoutDoc;
  /** The shared sections its linked copies show (F-ED-23); left as they are if left out. */
  readonly shared?: SharedSectionsDoc;
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
  /** The whole page after the edit: its own content, without the shared Header and Footer. */
  readonly page: PageDoc;
  /**
   * True if the edit changed the shared Header or Footer (F-ED-7): it belongs in the site's layout,
   * which every page shows, not in the page. `layout` then holds the layout after the edit.
   */
  readonly shared?: boolean;
  /** The shared Header and Footer after a `shared` edit. */
  readonly layout?: LayoutDoc;
  /**
   * Set when the edit was inside a linked copy (F-ED-23): it changed that copy's shared section,
   * and so every copy of it. `section` is the shared section after the edit; `page` is unchanged.
   */
  readonly sharedSection?: { readonly id: SharedSectionId; readonly section: NodeDoc };
  /** Set when the edit placed another linked copy of this shared section (a copy duplicated). */
  readonly copyOf?: SharedSectionId;
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
  /** The element around the selected one (F-ED-27: Mod + ↑); never past the page's sections. */
  | "selectParent"
  /** The selected element's first element inside (Mod + ↓). */
  | "selectChild"
  /** The selected element's neighbours in its own list (Mod + ← / →), stopping at its ends. */
  | "selectPreviousSibling"
  | "selectNextSibling"
  /** Starts editing the selected element's text, the caret at its end (Enter). */
  | "editText"
  /** Empties the selected element's text and starts editing it (Backspace): one text step. */
  | "clearText"
  | "moveUp"
  | "moveDown"
  | "duplicate"
  | "delete";

/**
 * A drag on the canvas that sets one field of one element, such as a spacing handle (1.32). From
 * `start` to `commit` it is one change; `cancel` (Esc) puts the value from before back.
 */
export type FieldDrag = {
  readonly phase: "start" | "update" | "commit" | "cancel";
  /** The element, as the canvas shows it. */
  readonly nodeId: string;
  readonly field: string;
  /**
   * The field's value for the device the canvas shows, as the Edit panel sets it: at `start` and
   * `cancel` the value from before, at `update` and `commit` the value the drag sets.
   */
  readonly value: unknown;
};

/**
 * What the selected element's quick actions ask the app to do (F-ED-25), since the app owns it:
 * hide or show the element (as Layers does), or open the image picker for its image (*Edit* on an
 * element with an image and no text).
 */
export type ElementRequest = {
  readonly kind: "toggleHidden" | "pickImage";
  readonly nodeId: string;
};

/** A right-click on an element of the canvas (1.35), at its point in the editor window. */
export type CanvasContextMenu = {
  /** The element, as the canvas shows it. */
  readonly nodeId: string;
  readonly x: number;
  readonly y: number;
};

/** Where the floating + asks to add a section: a position in the page's top-level list. */
export type InsertPoint = { readonly index: number };

/** Options of {@link CanvasEngine.mount}. */
export type MountOptions = {
  readonly library: ComponentLibrary;
  readonly theme: Theme;
  /**
   * Keeps an error inside the canvas (R3): it wraps everything the canvas draws, and shows its own
   * fallback instead after an error, so the rest of the editor keeps working. Without one, an
   * error takes the canvas down. When the boundary tries again, the canvas shows the current page.
   */
  readonly errorBoundary?: ComponentType<{ readonly children: ReactNode }>;
  /** Told about each error in the canvas: caught by `errorBoundary` (`caught`), or not. */
  readonly onError?: (error: unknown, caught: boolean) => void;
};

/**
 * The canvas: shows one page, lets the user arrange and edit it, and reports every edit. Webforge
 * owns the document and its history; the engine never keeps its own undo stack (decision C6,
 * architecture §6). Puck is one implementation; an own canvas would be another.
 */
export interface CanvasEngine {
  mount(el: HTMLElement, opts: MountOptions): void;
  /**
   * Shows `page` with the shared Header and Footer around it, and its linked copies as the shared
   * sections in `shared` (F-ED-23; none if left out).
   */
  loadPage(page: PageDoc, layout: LayoutDoc, shared?: SharedSectionsDoc): void;
  /** Shows a change made outside the engine, e.g. by undo. Keeps the selection if it still exists. */
  applyChange(change: DocChange): void;
  onUserEdit(cb: (edit: EngineEdit) => void): Unsubscribe;
  select(nodeId: string | null): void;
  /**
   * Outlines element `nodeId` on the canvas as a hovered element is, or none (`null`): for a
   * pointer over something outside the canvas that names it, such as a breadcrumb (1.30).
   */
  outline(nodeId: string | null): void;
  /**
   * The selection changed on the canvas. `adding` for a Ctrl/Cmd- or Shift-click (1.31): it adds
   * `nodeId` to the selection, or takes it out if it is in it already; the app keeps the set.
   */
  onSelectionChange(cb: (nodeId: string | null, adding: boolean) => void): Unsubscribe;
  /**
   * The other selected elements, while several are (1.31): outlined as the selected one is, and
   * the selected one's quick actions give way to the Edit menu's, which act on all. None: `[]`.
   */
  showSelected(others: readonly string[]): void;
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
  /**
   * Shows the site's Media images on the canvas (1.16): `image` turns a placed image's media id
   * into an image to show, or `null`. Called again when Media changes; the page is drawn again.
   */
  setImages(image: (mediaId: string) => ResolvedImage | null): void;
  /**
   * Lets the app pick links in rich text (F-ED-3, F-ED-18): the format toolbar's Link button calls
   * `picker` with the link at the caret, if any, and sets what it resolves to on the selected text
   * (`null` removes the link, `undefined` leaves it). Without a picker the toolbar has no Link
   * button.
   */
  setLinkPicker(picker: LinkPicker | null): void;
  /**
   * Shows the site's Site Settings values in elements bound to them (1.17): `setting` gives a
   * value, `emptySetting` what an empty one shows instead (a hint). Called again when Site
   * Settings change; the page is drawn again.
   */
  setSettings(
    setting: RenderContext["setting"],
    emptySetting?: RenderContext["emptySetting"],
  ): void;
  /**
   * Shows the site's navigation menu in the Header on the canvas (1.21), as the export draws it.
   * Called again when the menu, the pages or the page shown change; the page is drawn again.
   */
  setNavigation(navigation: RenderContext["navigation"]): void;
  setMode(mode: EditorMode): void;
  /** Shows the View menu's options on the canvas (F-ED-25); none until called. */
  setViewOptions(options: ViewOptions): void;
  /**
   * Does `action` to the selected element. Edits are reported through {@link onUserEdit} as one
   * step each, like the same action done with the mouse. Returns false if there is nothing to do:
   * no selection, the end of the list, or an action Content mode doesn't allow.
   */
  perform(action: CanvasAction): boolean;
  /**
   * The user drags a field's value on the canvas (1.32): the app records each drag as one history
   * step, and the canvas shows each value as the document changes.
   */
  onFieldDrag(cb: (drag: FieldDrag) => void): Unsubscribe;
  /** The selected element's quick actions ask for something only the app can do (F-ED-25). */
  onElementRequest(cb: (request: ElementRequest) => void): Unsubscribe;
  /**
   * The element menu was asked for on the canvas (1.35): a right-click on an element, or Shift+F10
   * or the menu key for the selected one. The app selects it and shows its menu there. Not in
   * Content mode, nor in text being edited, where the browser's own menu opens (its spelling
   * suggestions among it).
   */
  onContextMenu(cb: (menu: CanvasContextMenu) => void): Unsubscribe;
  /** The floating + between sections was clicked; the app decides what to add there. */
  onAddRequest(cb: (at: InsertPoint) => void): Unsubscribe;
  /**
   * Makes `element`, outside the canvas (an Add panel item, 1.13), drag a new `componentType` onto
   * it, with the canvas's drop indicators and only where that element may go (F-ED-1). The drop is
   * reported through {@link onUserEdit} as one `insert` edit that selects the new element. The
   * engine fills `element` with a see-through handle, so give it `position: relative`; clicks still
   * reach the element, though a click doesn't focus it (Puck's handle prevents the mouse-down). The
   * handle can't be focused or seen by screen readers: the element keeps its own keyboard use.
   * Until the returned call, which removes the handle.
   */
  addDragSource(element: HTMLElement, componentType: string): Unsubscribe;
  /**
   * The canvas iframe's window whenever it changes (`null` when it goes), so the app can handle its
   * keyboard shortcuts there too.
   */
  onFrameWindow(cb: (frameWindow: Window | null) => void): Unsubscribe;
  /**
   * `page`'s static HTML, as the export renders it (ADR 0005): the Header and Footer of `layout`
   * (as the page shows them), then its content, its linked copies shown inline as the shared
   * sections in `shared`, without hidden elements. `context` resolves links, images and settings;
   * the editor's, where everything goes nowhere, if left out.
   */
  renderStatic(
    page: PageDoc,
    layout: LayoutDoc,
    shared?: SharedSectionsDoc,
    context?: RenderContext,
  ): string;
  destroy(): void;
}
