import {
  type AppState,
  type Config,
  createUsePuck,
  type Data,
  type Overrides,
  Puck,
  type PuckAction,
  Render,
  useGetPuck,
} from "@puckeditor/core";
// Puck's default stylesheet loads the Inter font from rsms.me; Webforge makes no external requests.
import "@puckeditor/core/no-external.css";
import { t } from "@webforge/i18n";
import {
  expandSharedCopies,
  type LayoutDoc,
  newSharedCopy,
  type PageDoc,
  type SharedSectionsDoc,
} from "@webforge/model";
import {
  type ComponentLibrary,
  EDITOR_RENDER_CONTEXT,
  type RenderContext,
} from "@webforge/site-components";
import { type ComponentProps, type ReactNode, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import type {
  CanvasEngine,
  CanvasSize,
  EditorMode,
  EngineEdit,
  HistoryCommandHandler,
  InsertPoint,
  LinkPicker,
  RichTextAt,
  Viewport,
} from "../canvas-engine.js";
import { installHistoryKeys } from "../history-keys.js";
import { preserveCaret, refocusRichText } from "./caret.js";
import { applyChromeStyles, createSelectionOutline, QuickActionBar } from "./chrome.js";
import { toPuckConfig } from "./config.js";
import { deferredCommands } from "./deferred-commands.js";
import { puckDictionary } from "./dictionary.js";
import { createDragSources } from "./drag-sources.js";
import { editFromAction, selectedNodeId, toPageDoc } from "./edit-from-action.js";
import { pageActions, type SlotsOf } from "./page-actions.js";
import { createFormatToolbar } from "./rich-text.js";
import { performOnSelected } from "./selected-actions.js";
import { copiesOn, copyShownBy, foldCopies } from "./shared-copies.js";
import {
  composePage,
  EMPTY_LAYOUT,
  isShared,
  isSharedRegion,
  sameNodes,
  sameOrder,
  splitPage,
} from "./shared-layout.js";
import { applySiteStyles, type SiteStyles } from "./site-styles.js";
import { focusedRichTextId, staleRichText } from "./stale-rich-text.js";
import { allNodes, findNode, nodeAt } from "./tree.js";

/** Options of {@link createPuckEngine}. */
export type PuckEngineOptions = {
  /** Render the canvas in an iframe (default). Tests without layout may turn it off. */
  readonly iframe?: boolean;
};

/**
 * Asks the focused rich-text editor to send the change Puck still holds back (it sends after a
 * short debounce), through our Puck patch. True if there was one: its edit is then on its way.
 */
function flushRichText(puck: ReturnType<GetPuck>): boolean {
  const flush = (puck as { readonly __private?: { readonly flushRichText?: () => boolean } })
    .__private?.flushRichText;
  return flush?.() === true;
}

/** How long Undo or Redo waits at most for a rich-text change it asked Puck to send. */
const RICH_TEXT_FLUSH_TIMEOUT_MS = 500;

/** Puck's canvas zoom (`zoomConfig`), which its public API leaves out. */
type ZoomConfig = { readonly zoom: number; readonly autoZoom: number; readonly rootHeight: number };

/** What our Puck patch adds to Puck's API object: its canvas zoom. */
type ZoomAccess = {
  readonly getZoomConfig: () => ZoomConfig;
  readonly setZoomConfig: (zoomConfig: ZoomConfig) => void;
};

/**
 * The canvas zoom in Puck's store, reached through our Puck patch (see `pnpm-workspace.yaml`), or
 * undefined if the patch is missing, e.g. after a Puck upgrade: zooming then does nothing.
 */
function zoomAccess(puck: ReturnType<GetPuck>): ZoomAccess | undefined {
  const internal = (puck as { readonly __private?: Partial<ZoomAccess> }).__private;
  const get = internal?.getZoomConfig;
  const set = internal?.setZoomConfig;
  return get === undefined || set === undefined
    ? undefined
    : { getZoomConfig: get, setZoomConfig: set };
}

const VIEWPORT_WIDTHS = { desktop: 1280, tablet: 768, mobile: 375 } as const;

/** A canvas width as the app names it: a device view, or a custom width. */
function viewportOf(width: number): Viewport {
  const named = (Object.keys(VIEWPORT_WIDTHS) as (keyof typeof VIEWPORT_WIDTHS)[]).find(
    (name) => VIEWPORT_WIDTHS[name] === width,
  );
  return named ?? width;
}

/** The device views Puck's canvas controls offer: Desktop · Tablet · Mobile (until 1.15). */
const puckViewports = () => [
  { width: VIEWPORT_WIDTHS.mobile, label: t("device.mobile"), icon: "Smartphone" as const },
  { width: VIEWPORT_WIDTHS.tablet, label: t("device.tablet"), icon: "Tablet" as const },
  { width: VIEWPORT_WIDTHS.desktop, label: t("device.desktop"), icon: "Monitor" as const },
];

/** Content mode: text stays editable, the layout is locked (M3). */
const CONTENT_MODE_PERMISSIONS = { drag: false, duplicate: false, delete: false, insert: false };

type GetPuck = ReturnType<typeof useGetPuck>;

const usePuck = createUsePuck();

const EMPTY_PAGE: PageDoc = { root: { props: {} }, content: [] };

function toPuckData(page: PageDoc): Data {
  // PageDoc is the same tree as Puck's Data (see toPageDoc); only the TypeScript types differ.
  return page as unknown as Data;
}

type Emitter<T> = { add(listener: (value: T) => void): () => void; emit(value: T): void };

function emitter<T>(): Emitter<T> {
  const listeners = new Set<(value: T) => void>();
  return {
    add(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    emit(value) {
      for (const listener of listeners) listener(value);
    },
  };
}

/**
 * The Puck implementation of {@link CanvasEngine}.
 *
 * Puck stays in charge of drag-and-drop, selection and inline editing, but not of history:
 * - every user action arrives through `onAction` and is reported as an {@link EngineEdit};
 * - undo, redo and jumps come back through `applyChange` as Puck's atomic actions (or `setData` for
 *   changes too big to translate), with `recordHistory: false`;
 * - Puck's header (with its Undo/Redo buttons) is replaced, and its Ctrl/Cmd+Z hotkeys never fire
 *   because {@link installHistoryKeys} takes those keys first, in the host and in the iframe.
 */
export function createPuckEngine(options: PuckEngineOptions = {}): CanvasEngine {
  let root: Root | null = null;
  let host: HTMLElement | null = null;
  let library: ComponentLibrary | null = null;
  let config: Config | null = null;
  let slotsOf: SlotsOf = () => undefined;
  let getPuck: GetPuck | null = null;
  /**
   * The page as the app last gave it (`loadPage`, `applyChange`) or as Puck last reported it. Kept
   * as the app's own object, so its next change can be recognised by reference.
   */
  let page: PageDoc = EMPTY_PAGE;
  /** The shared Header and Footer the canvas shows around the page (F-ED-7). */
  let layout: LayoutDoc = EMPTY_LAYOUT;
  /** The shared sections the page's linked copies show (F-ED-23). */
  let shared: SharedSectionsDoc = {};
  /** Bumped whenever the app gives the engine a different page. */
  let revision = 0;
  /** The revision Puck shows; behind `revision` while the app's page hasn't reached Puck yet. */
  let shownRevision = 0;
  let selection: string | null = null;
  let mode: EditorMode = "design";
  /** True while Puck runs `onAction`, inside its store update: dispatching then would be lost. */
  let inAction = false;
  /** True while Webforge itself dispatches to Puck. */
  let applying = false;
  /** True while listeners handle an edit: its echo through `applyChange` needs no comparison. */
  let reporting = false;
  /** The canvas iframe's document, once Puck has created it. */
  let frameDocument: Document | null = null;
  /** The site's CSS, applied to the canvas document whenever there is one. */
  let siteStyles: SiteStyles | null = null;
  /** What the canvas renders with: no navigation or links, and the site's Media images. */
  let renderContext: RenderContext = EDITOR_RENDER_CONTEXT;
  /** The canvas width Puck shows, or is about to show. */
  let viewportWidth: number = VIEWPORT_WIDTHS.desktop;
  /** A width the app gave Puck that Puck doesn't show yet: until it does, no width is reported. */
  let pendingWidth: number | null = null;
  /** The size and zoom last reported. */
  let canvasSize: CanvasSize | null = null;
  /** Per node, bumped to remount its rich-text editors (see toPuckConfig). */
  const editorRevisions = new Map<string, number>();

  const edits = emitter<EngineEdit>();
  const addRequests = emitter<InsertPoint>();
  const dragSources = createDragSources(
    (componentType) => library?.components[componentType]?.label ?? componentType,
  );
  const frameWindows = emitter<Window | null>();
  const selections = emitter<string | null>();
  const canvasSizes = emitter<CanvasSize>();
  const viewports = emitter<Viewport>();
  const commandHandlers = new Set<HistoryCommandHandler>();
  /** True if any handler did something with the command (see installHistoryKeys). */
  const runHandlers: HistoryCommandHandler = (command) => {
    let handled = false;
    for (const handler of commandHandlers) handled = handler(command) === true || handled;
    return handled;
  };
  // Undo and Redo pressed while typing rich text wait for its last keystrokes (#146).
  const commands = deferredCommands(
    runHandlers,
    () => getPuck !== null && flushRichText(getPuck()),
    RICH_TEXT_FLUSH_TIMEOUT_MS,
  );
  const runCommand = commands.run;

  const dispatch = (action: PuckAction) => {
    if (getPuck === null) {
      return; // Not ready yet: the Bridge sends the current page once it is.
    }
    if (inAction) {
      queueMicrotask(() => dispatch(action));
      return;
    }
    const puck = getPuck;
    applying = true;
    try {
      puck().dispatch(action);
    } finally {
      applying = false;
    }
  };

  /** Sends `page` to Puck, unless Puck isn't ready yet (then the Bridge sends it once it is). */
  const showPage = () => {
    if (getPuck !== null) {
      dispatch({
        type: "setData",
        data: () => toPuckData(composePage(page, layout, shared)),
        recordHistory: false,
      });
      shownRevision = revision;
    }
  };

  /** Shows `viewportWidth` in Puck, if it isn't already (the Bridge calls this once Puck is ready). */
  const showViewport = () => {
    if (getPuck === null) {
      return;
    }
    // A width still on its way to Puck counts as shown: a later one must replace it.
    const shown = pendingWidth ?? getPuck().appState.ui.viewports.current.width;
    if (shown === viewportWidth) {
      return;
    }
    pendingWidth = viewportWidth;
    const width = viewportWidth;
    dispatch({
      type: "setUi",
      ui: (ui) => ({ viewports: { ...ui.viewports, current: { width, height: "auto" } } }),
    });
  };

  /** Scales Puck's canvas to `zoom`, or to its fitting zoom. Does nothing before Puck is ready. */
  const applyZoom = (zoom: number | "fit") => {
    const access = getPuck === null ? undefined : zoomAccess(getPuck());
    if (access === undefined) {
      return;
    }
    const config = access.getZoomConfig();
    const next = zoom === "fit" ? config.autoZoom : zoom;
    if (Number.isFinite(next) && next > 0 && next !== config.zoom) {
      access.setZoomConfig({ ...config, zoom: next });
    }
  };

  /** Reports the canvas's size and zoom if they changed, once Puck has measured the canvas. */
  const reportSize = () => {
    sizeFrame = null;
    const puck = getPuck?.();
    const config = puck === undefined ? undefined : zoomAccess(puck)?.getZoomConfig();
    const width = puck?.appState.ui.viewports.current.width;
    if (config === undefined || typeof width !== "number" || !(config.rootHeight > 0)) {
      return;
    }
    const size = { width, height: Math.round(config.rootHeight), zoom: config.zoom };
    if (
      canvasSize === null ||
      canvasSize.width !== size.width ||
      canvasSize.height !== size.height ||
      canvasSize.zoom !== size.zoom
    ) {
      canvasSize = size;
      canvasSizes.emit(size);
    }
  };

  /**
   * Reports the size at the next frame: Puck sets a new zoom and the height that goes with it in
   * two renders, which then arrive as one change.
   */
  let sizeFrame: number | null = null;
  const scheduleSize = () => {
    sizeFrame ??= requestAnimationFrame(reportSize);
  };

  /** Puck shows `width`: the app's own width arriving, or the user's choice in Puck's controls. */
  const reportViewport = (width: number | "100%") => {
    if (pendingWidth !== null) {
      if (width === pendingWidth) pendingWidth = null;
      return;
    }
    if (typeof width === "number" && width !== viewportWidth) {
      viewportWidth = width;
      viewports.emit(viewportOf(width));
    }
  };

  const selectorFor = (id: string | null) =>
    id === null ? null : (getPuck?.().getSelectorForId(id) ?? null);

  /**
   * Puts Puck's view back in step with the page and layout, from `shown`, what Puck shows now: the
   * Header and Footer in their places, the page's content between them (F-ED-7). With
   * `whenOutOfOrder`, only if their top-level order differs. Runs after Puck's own update, where a
   * dispatch would be lost.
   */
  const putBack = (shown: PageDoc, whenOutOfOrder = false) => {
    queueMicrotask(() => {
      const wanted = composePage(page, layout, shared);
      if (getPuck === null || (whenOutOfOrder && sameOrder(shown, wanted))) {
        return;
      }
      const actions = pageActions(shown, wanted, slotsOf);
      if (actions === null) {
        showPage();
      } else {
        for (const action of actions) dispatch({ ...action, recordHistory: false });
      }
    });
  };

  /** Reports `edit` to the app, as the document store will take it over. */
  const emitEdit = (edit: EngineEdit) => {
    reporting = true;
    try {
      edits.emit(edit);
    } finally {
      reporting = false;
    }
  };

  /**
   * Reports an edit Puck made to the page as the canvas shows it, split back into the page, the
   * shared layout (F-ED-7) and the shared sections its linked copies show (F-ED-23):
   * - an edit inside the Header or Footer goes to the layout, which every page shows;
   * - an edit inside a copy goes to its shared section, and so to every copy of it;
   * - anything else is the page's own, a copy itself included (moved or deleted as a whole).
   * The Header and Footer themselves can't be moved, duplicated or deleted from the canvas, and an
   * element can't be moved between them, a copy and the page: Puck's view is put back instead. A
   * duplicated copy is another linked copy of its section. A page element Puck shows above the
   * Header or below the Footer belongs to the page, and goes back between them.
   */
  const reportEdit = (edit: EngineEdit, action: PuckAction, prev: AppState) => {
    const before = toPageDoc(prev.data);
    const touchedNode =
      action.type === "duplicate"
        ? nodeAt(before, action.sourceZone, action.sourceIndex)
        : action.type === "remove"
          ? nodeAt(before, action.zone, action.index)
          : undefined;
    const touched = touchedNode?.props.id ?? (edit.kind === "move" ? edit.nodeId : null);
    if (typeof touched === "string" && isSharedRegion(layout, touched)) {
      putBack(edit.page);
      return;
    }
    const copy =
      action.type === "duplicate" && touchedNode !== undefined
        ? copyShownBy(touchedNode, copiesOn(page.content), shared)
        : undefined;
    if (copy !== undefined) {
      const at = page.content.indexOf(copy);
      const added = newSharedCopy(page.content, copy.props.sharedSectionId);
      const content = [...page.content];
      content.splice(at + 1, 0, added);
      page = { ...page, content };
      emitEdit({ ...edit, nodeId: added.props.id, page, selection: added.props.id });
      putBack(edit.page);
      return;
    }
    const split = splitPage(edit.page, layout);
    const folded = foldCopies(split.page.content, page.content, shared, edit.nodeId);
    const id = edit.nodeId;
    // In the Header or Footer as they were (an edit, a removal) or are now (an element added in one).
    const inLayout = id !== null && (isShared(layout, id) || isShared(split.layout, id));
    const layoutChanged = !sameNodes(
      [...split.layout.header, ...split.layout.footer],
      [...layout.header, ...layout.footer],
    );
    const pageChanged = !sameNodes(folded.content, page.content);
    const [section, ...others] = folded.sections;
    const crossed = inLayout
      ? pageChanged || section !== undefined
      : section !== undefined
        ? pageChanged || layoutChanged || others.length > 0
        : layoutChanged;
    if (crossed) {
      putBack(edit.page);
      return;
    }
    if (inLayout) {
      layout = split.layout;
      emitEdit({ ...edit, page, shared: true, layout });
    } else if (section !== undefined) {
      const [sectionId, content] = section;
      const entry = shared[sectionId];
      if (entry !== undefined) shared = { ...shared, [sectionId]: { ...entry, section: content } };
      // A one-field patch names the copy's element; the section is recorded whole instead.
      const { patch: _patch, ...whole } = edit;
      emitEdit({ ...whole, page, sharedSection: { id: sectionId, section: content } });
      // Every other copy of the section shows the change too.
      putBack(edit.page);
      return;
    } else {
      page = { root: split.page.root, content: folded.content };
      emitEdit({ ...edit, page });
    }
    putBack(edit.page, true);
  };

  const handleAction = (action: PuckAction, next: AppState, prev: AppState) => {
    inAction = true;
    try {
      if (applying) {
        return;
      }
      if (library !== null) {
        const edit = editFromAction(action, next, prev, library);
        if (edit !== null) {
          reportEdit(edit, action, prev);
          // An Undo or Redo was waiting for this edit: it runs now, outside Puck's own update.
          commands.edited();
        }
      }
      // After the edit, so the history records the selection from before it.
      reportSelection(selectedNodeId(next));
    } finally {
      inAction = false;
    }
  };

  const reportSelection = (id: string | null) => {
    if (id !== selection) {
      selection = id;
      selections.emit(id);
    }
  };

  function Bridge({ children }: { children: ReactNode }) {
    const get = useGetPuck();
    // Some selections bypass onAction (Puck's inline text field selects through an internal
    // helper), so watch the selected item too.
    const selectedId = usePuck((state) => state.selectedItem?.props.id ?? null);
    useEffect(() => reportSelection(selectedId), [selectedId]);
    const width = usePuck((state) => state.appState.ui.viewports.current.width);
    useEffect(() => {
      getPuck = get;
      if (shownRevision !== revision) {
        showPage();
      }
      // A width set before Puck was ready, or Puck's own starting width.
      showViewport();
      // A selection made before Puck was ready. Only when it differs: re-selecting resets Puck's
      // field focus and remounts an open rich-text editor (this effect re-runs on re-renders).
      if ((get().selectedItem?.props.id ?? null) !== selection) {
        dispatch({ type: "setUi", ui: { itemSelector: selectorFor(selection) } });
      }
      return () => {
        getPuck = null;
        pendingWidth = null;
        // A remounted Puck starts from whatever `data` it was last rendered with: resend the page.
        shownRevision = -1;
      };
    }, [get]);
    // After the effect above, so the width it sends to Puck isn't taken for the user's choice.
    useEffect(() => {
      reportViewport(width);
      scheduleSize();
    }, [width]);
    // Puck changes the zoom inside its store, where nothing reports it, and shows it on the canvas
    // root's style (its scale and height): watch that.
    useEffect(() => {
      const canvasRoot = host?.querySelector('[class*="PuckCanvas-root"]');
      if (!canvasRoot) {
        return;
      }
      scheduleSize();
      const observer = new MutationObserver(scheduleSize);
      observer.observe(canvasRoot, { attributes: true, attributeFilter: ["style"] });
      return () => {
        observer.disconnect();
        if (sizeFrame !== null) cancelAnimationFrame(sizeFrame);
        sizeFrame = null;
      };
    }, []);
    return (
      <>
        {children}
        <dragSources.Portals />
      </>
    );
  }

  /** The quick actions, locked on the shared Header or Footer itself (F-ED-7). */
  function SharedAwareActionBar(props: ComponentProps<typeof QuickActionBar>) {
    return <QuickActionBar {...props} isLocked={(id) => isSharedRegion(layout, id)} />;
  }

  function CanvasFrame({ children, document }: { children: ReactNode; document?: Document }) {
    useEffect(() => {
      frameDocument = document ?? null;
      if (document !== undefined) {
        applyChromeStyles(document);
        if (siteStyles !== null) applySiteStyles(document, siteStyles);
      }
      const frameWindow = document?.defaultView;
      if (!frameWindow) {
        return undefined;
      }
      frameWindows.emit(frameWindow);
      const removeKeys = installHistoryKeys(frameWindow, runCommand);
      return () => {
        removeKeys();
        frameWindows.emit(null);
      };
    }, [document]);
    return <>{children}</>;
  }

  const dictionary = puckDictionary();
  // Kept, not rebuilt per render: Puck resets the canvas width whenever these change.
  const iframe = { enabled: options.iframe ?? true, syncHostStyles: false };
  const viewportOptions = puckViewports();

  const overrides: Partial<Overrides> = {
    // Replaces Puck's header, which holds Puck's own Undo/Redo buttons.
    header: () => <></>,
    puck: Bridge,
    iframe: CanvasFrame,
    // Selection chrome (1.12): magenta outlines and the selected element's quick actions.
    componentOverlay: createSelectionOutline((at) =>
      // The floating + counts the Header's nodes; the app adds to the page's own content.
      addRequests.emit({
        index: Math.min(Math.max(at.index - layout.header.length, 0), page.content.length),
      }),
    ),
    actionBar: SharedAwareActionBar,
  };

  /** Picks links in rich text for the format toolbar (F-ED-18); none until the app gives one. */
  let linkPicker: LinkPicker | null = null;
  /**
   * The rich-text field being edited: the selected element, and the inline field Puck has focused
   * (`text::inline`). Read when the toolbar's Link button is clicked, before the dialog takes focus.
   */
  const editingRichText = (): RichTextAt | null => {
    const state = getPuck?.();
    const nodeId = state?.selectedItem?.props.id;
    const focus = state?.appState.ui.field.focus;
    return typeof nodeId === "string" && typeof focus === "string"
      ? { nodeId, field: focus.replace(/::inline$/, "") }
      : null;
  };
  const formatToolbar = createFormatToolbar(() => {
    const picker = linkPicker;
    return picker === null ? null : (current) => picker(current, editingRichText());
  });

  /** The Puck config for `library`, rendering with the current editor revisions and context. */
  const configFor = (forLibrary: ComponentLibrary) =>
    toPuckConfig(
      forLibrary,
      (id) => editorRevisions.get(id) ?? 0,
      () => renderContext,
      formatToolbar,
    );

  /**
   * Draws the page again with the current render context. Puck draws a component again only when
   * its props or its config change, and an image or a Site Settings value can change without any
   * props changing (deleted from Media, cropped, renamed): give Puck a new config.
   */
  const redraw = () => {
    if (library !== null) {
      config = configFor(library);
      preserveCaret(frameDocument);
      render();
    }
  };

  const render = () => {
    if (root === null || config === null) {
      return;
    }
    root.render(
      <Puck
        config={config}
        data={toPuckData(composePage(page, layout, shared))}
        onAction={handleAction}
        dictionary={dictionary}
        overrides={overrides}
        iframe={iframe}
        // The editor's own Edit panel shows the fields (1.14), not Puck's right sidebar; its Add
        // panel (1.13) and Layers (1.24) replace Puck's left one.
        ui={{
          leftSideBarVisible: false,
          rightSideBarVisible: false,
          // Puck starts with the app's width; without one it picks the view nearest the window's.
          viewports: {
            current: { width: viewportWidth, height: "auto" },
            options: [],
            // The canvas toolbar chooses the view and zoom (1.15), not Puck's own controls.
            controlsVisible: false,
          },
        }}
        viewports={viewportOptions}
        height="100%"
        {...(mode === "content" ? { permissions: CONTENT_MODE_PERMISSIONS } : {})}
      />,
    );
  };

  return {
    mount(el, opts) {
      if (root !== null) {
        throw new Error("The canvas engine is already mounted");
      }
      host = el;
      library = opts.library;
      const slots = new Map(
        Object.entries(opts.library.components).map(([type, def]) => [
          type,
          Object.entries(def.fields)
            .filter(([, field]) => field.kind === "slot")
            .map(([name]) => name),
        ]),
      );
      slotsOf = (type) => slots.get(type);
      config = configFor(opts.library);
      root = createRoot(el);
      render();
      // Puck starts with the current page.
      shownRevision = revision;
    },

    loadPage(nextPage, nextLayout, nextShared = {}) {
      page = nextPage;
      layout = nextLayout;
      shared = nextShared;
      revision++;
      editorRevisions.clear();
      reportSelection(null);
      showPage();
      dispatch({ type: "setUi", ui: { itemSelector: null } });
    },

    applyChange({ page: nextPage, layout: nextLayout = layout, shared: nextShared = shared }) {
      if (reporting) {
        // The document store just took over the edit Puck reported: same content, nothing to show.
        page = nextPage;
        layout = nextLayout;
        shared = nextShared;
        return;
      }
      if (nextPage === page && nextLayout === layout && nextShared === shared) {
        return;
      }
      const before = composePage(page, layout, shared);
      const after = composePage(nextPage, nextLayout, nextShared);
      // The rich-text editor being typed in, if this change remounts it (Undo while typing).
      let refocus: string | null = null;
      if (library !== null) {
        const focused = focusedRichTextId(frameDocument);
        for (const id of staleRichText(library, before, after)) {
          editorRevisions.set(id, (editorRevisions.get(id) ?? 0) + 1);
          if (id === focused) refocus = id;
        }
        const ids = new Set(allNodes(after).map((node) => node.props.id));
        for (const id of editorRevisions.keys()) {
          if (!ids.has(id)) editorRevisions.delete(id);
        }
      }
      // Only what changed, unless Puck shows an older page or the change is too big to translate.
      const actions =
        getPuck !== null && shownRevision === revision ? pageActions(before, after, slotsOf) : null;
      page = nextPage;
      layout = nextLayout;
      shared = nextShared;
      revision++;
      preserveCaret(frameDocument);
      if (refocus !== null) refocusRichText(frameDocument, refocus);
      if (actions === null) {
        showPage();
      } else {
        for (const action of actions) dispatch({ ...action, recordHistory: false });
        shownRevision = revision;
      }
      // Puck selects by position; keep the same element selected, or none if it is gone.
      if (selection !== null && findNode(after, selection) === undefined) {
        selection = null;
        selections.emit(null);
      }
      dispatch({ type: "setUi", ui: { itemSelector: selectorFor(selection) } });
    },

    onUserEdit: edits.add,
    onSelectionChange: selections.add,
    onHistoryCommand(handler) {
      commandHandlers.add(handler);
      return () => {
        commandHandlers.delete(handler);
      };
    },

    select(nodeId) {
      if (nodeId === selection) {
        return;
      }
      selection = nodeId;
      dispatch({ type: "setUi", ui: { itemSelector: selectorFor(nodeId) } });
    },

    setViewport(viewport: Viewport) {
      viewportWidth = typeof viewport === "number" ? viewport : VIEWPORT_WIDTHS[viewport];
      showViewport();
    },

    onViewportChange: viewports.add,

    setImages(image) {
      renderContext = { ...renderContext, image };
      redraw();
    },

    setLinkPicker(picker) {
      linkPicker = picker;
    },

    setSettings(setting, emptySetting) {
      const { emptySetting: _previous, ...rest } = renderContext;
      renderContext = { ...rest, setting, ...(emptySetting === undefined ? {} : { emptySetting }) };
      redraw();
    },

    setZoom: applyZoom,

    onCanvasSize(cb) {
      if (canvasSize !== null) {
        cb(canvasSize);
      }
      return canvasSizes.add(cb);
    },

    setSiteCss(css, bodyClass) {
      siteStyles = { css, bodyClass };
      if (frameDocument !== null) {
        applySiteStyles(frameDocument, siteStyles);
      }
    },

    perform(action) {
      const puck = getPuck;
      if (puck === null || inAction || !performOnSelected(puck(), action)) {
        return false;
      }
      if (action === "selectPrevious" || action === "selectNext") {
        // Walking through a long page with the arrows keeps the selection in view.
        const id = puck().selectedItem?.props.id;
        const doc = frameDocument ?? host?.ownerDocument;
        const element =
          id === undefined ? null : doc?.querySelector(`[data-puck-component="${id}"]`);
        element?.scrollIntoView?.({ block: "nearest" });
      }
      return true;
    },

    onAddRequest: addRequests.add,

    addDragSource: dragSources.add,

    onFrameWindow(cb) {
      const current = frameDocument?.defaultView;
      if (current) {
        cb(current);
      }
      return frameWindows.add(cb);
    },

    setMode(nextMode) {
      mode = nextMode;
      render();
    },

    renderStatic(staticPage, staticLayout, staticShared = {}) {
      if (config === null) {
        throw new Error("Mount the canvas engine before rendering pages");
      }
      // Linked copies inline, as their shared sections (F-ED-23).
      const content = expandSharedCopies(staticPage.content, staticShared);
      return renderToStaticMarkup(
        <Render config={config} data={toPuckData({ ...staticPage, content })} />,
      );
    },

    destroy() {
      // An Undo still waiting for its rich-text edit goes with the canvas.
      commands.dispose();
      const mounted = root;
      const element = host;
      root = null;
      host = null;
      getPuck = null;
      frameDocument = null;
      // Unmount after the current render: the app destroys the engine from an effect cleanup.
      queueMicrotask(() => {
        mounted?.unmount();
        element?.replaceChildren();
      });
    },
  };
}
