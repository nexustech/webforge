import {
  type AppState,
  type Config,
  createUsePuck,
  type Overrides,
  Puck,
  type PuckAction,
  useGetPuck,
} from "@puckeditor/core";
// Puck's default stylesheet loads the Inter font from rsms.me; Webforge makes no external requests.
import "@puckeditor/core/no-external.css";
import {
  expandSharedCopies,
  type LayoutDoc,
  type NodeDoc,
  type PageDoc,
  type SharedCopyNode,
  type SharedSectionsDoc,
} from "@webforge/model";
import {
  type ComponentLibrary,
  EDITOR_RENDER_CONTEXT,
  type RenderContext,
  renderPage,
} from "@webforge/site-components";
import { type ComponentType, type ReactNode, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import type {
  CanvasContextMenu,
  CanvasEngine,
  EditorMode,
  ElementRequest,
  EngineEdit,
  FieldDrag,
  HistoryCommandHandler,
  InsertPoint,
  LinkPicker,
  RichTextAt,
  TextSplit,
  ViewOptions,
} from "../canvas-engine.js";
import { installHistoryKeys } from "../history-keys.js";
import { installMenuKeys } from "../menu-keys.js";
import { createActionBar } from "./action-bar.js";
import { createCanvasSync } from "./canvas-sync.js";
import { createCanvasView } from "./canvas-view.js";
import { preserveCaret, refocusRichText } from "./caret.js";
import { applyChromeStyles, createSelectionOutline, OUTLINED_ATTRIBUTE } from "./chrome.js";
import { toPuckConfig } from "./config.js";
import { installContextMenu } from "./context-menu.js";
import { copyDrop, planCopyDrop } from "./copy-drop.js";
import { deferredCommands } from "./deferred-commands.js";
import { hidePuckDeleteKeys } from "./delete-keys.js";
import { puckDictionary } from "./dictionary.js";
import { type DragKeys, type Drop, trackDragKeys } from "./drag-copies.js";
import { createDragSources } from "./drag-sources.js";
import { editFromAction, selectedNodeId, toPageDoc } from "./edit-from-action.js";
import { elementNames } from "./element-names.js";
import { keepElementsEnabled } from "./enabled-elements.js";
import {
  CONTENT_MODE_PERMISSIONS,
  DESIGN_MODE_PERMISSIONS,
  EMPTY_PAGE,
  emitter,
  flushRichText,
  memoByDocs,
  NO_VIEW_OPTIONS,
  NoBoundary,
  puckViewports,
  RICH_TEXT_FLUSH_TIMEOUT_MS,
  toPuckData,
} from "./engine-support.js";
import { hidePuckLayout } from "./layout-styles.js";
import { pageActions, type SlotsOf } from "./page-actions.js";
import { CANVAS_ROOT, componentSelector } from "./puck-dom.js";
import { createFormatToolbar } from "./rich-text.js";
import { type CanvasDocs, type RoutedEdit, routeEdit, routeLinkedCopy } from "./route-edit.js";
import { performOnSelected } from "./selected-actions.js";
import { showAlsoSelected, watchAddingClicks } from "./selection-clicks.js";
import { composePage, EMPTY_LAYOUT, sameOrder } from "./shared-layout.js";
import { applySiteStyles, type SiteStyles } from "./site-styles.js";
import { boxHandleFields } from "./spacing-handles.js";
import { focusedRichTextId, richTextArrived, staleRichText } from "./stale-rich-text.js";
import { startTextEditing } from "./text-editing.js";
import { createTextKeys, type PickLink } from "./text-keys.js";
import { allNodes, findNode } from "./tree.js";
import { applyViewOptions } from "./view-options.js";

/** Options of {@link createPuckEngine}. */
export type PuckEngineOptions = {
  /** Render the canvas in an iframe (default). Tests without layout may turn it off. */
  readonly iframe?: boolean;
};

type GetPuck = ReturnType<typeof useGetPuck>;

const usePuck = createUsePuck();

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
  /** What wraps the canvas (`MountOptions.errorBoundary`); nothing until one is given. */
  let ErrorBoundary: ComponentType<{ readonly children: ReactNode }> = NoBoundary;
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
  /** Which page Puck shows, and whose change is under way (see `canvas-sync.ts`). */
  const sync = createCanvasSync();
  let selection: string | null = null;
  let mode: EditorMode = "design";
  /** The canvas iframe's document, once Puck has created it. */
  let frameDocument: Document | null = null;
  /** Stops keeping the canvas's elements enabled; set in Content mode (see `keepElementsEnabled`). */
  let stopKeepingEnabled: (() => void) | null = null;
  /** Stops hiding Delete and Backspace from Puck in the editor window (see `delete-keys.ts`). */
  let stopHidingHostKeys: (() => void) | null = null;
  /** Stops following the keys held in the editor window during a drag (see `drag-copies.ts`). */
  let stopTrackingHostKeys: (() => void) | null = null;
  /** Stops watching clicks that add to the selection in the editor window (iframe-less canvas). */
  let stopHostClicks: (() => void) | null = null;
  const followMode = () => {
    stopKeepingEnabled?.();
    stopKeepingEnabled =
      mode === "content" && frameDocument !== null ? keepElementsEnabled(frameDocument) : null;
  };
  /** The names the View menu's labels show, by id, for the page shown: made once per change. */
  const names = memoByDocs((docs: CanvasDocs) => elementNames(docs, library));
  /** An element's name for the labels: its Layers name, else its component's. */
  const nameOf = (id: string) => names({ page, layout, shared }).get(id);
  /** The View menu's options (F-ED-25), shown in the canvas document while there is one. */
  let viewOptions: ViewOptions = NO_VIEW_OPTIONS;
  let stopViewOptions: (() => void) | null = null;
  const followViewOptions = () => {
    stopViewOptions?.();
    stopViewOptions =
      frameDocument === null ? null : applyViewOptions(frameDocument, viewOptions, nameOf);
  };
  /** The site's CSS, applied to the canvas document whenever there is one. */
  let siteStyles: SiteStyles | null = null;
  /** What the canvas renders with: no navigation or links, and the site's Media images. */
  let renderContext: RenderContext = EDITOR_RENDER_CONTEXT;
  /** Per node, bumped to remount its rich-text editors (see toPuckConfig). */
  const editorRevisions = new Map<string, number>();

  const edits = emitter<EngineEdit>();
  const addRequests = emitter<InsertPoint>();
  const fieldDrags = emitter<FieldDrag>();
  const elementRequests = emitter<ElementRequest>();
  const textSplits = emitter<TextSplit>();
  const contextMenus = emitter<CanvasContextMenu>();
  const dragSources = createDragSources(
    (componentType) => library?.components[componentType]?.label ?? componentType,
  );
  const frameWindows = emitter<Window | null>();
  /** Selection changes: `adding` for a Ctrl/Cmd/Shift-click that adds or takes away (1.31). */
  const selections = emitter<{ readonly id: string | null; readonly adding: boolean }>();
  /** The element a Ctrl/Cmd/Shift-click is on, which Puck is about to select (1.31). */
  let addingClick: string | null = null;
  /** The other selected elements while several are, outlined too (1.31). */
  let alsoSelected: readonly string[] = [];
  const alsoSelectedChanged = emitter<void>();
  /** Watches clicks that add to the selection in `target` (see `selection-clicks.ts`). */
  const watchClicks = (target: Window) =>
    watchAddingClicks(target, (id) => {
      // On the element selected already, Puck selects nothing new: it is reported here.
      if (id !== null && id === selection) {
        addingClick = null;
        selections.emit({ id, adding: true });
      } else {
        addingClick = id;
      }
    });
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
    () =>
      richTextArrived(
        frameDocument,
        composePage(page, layout, shared),
        getPuck?.().appState.ui.field.focus,
      ),
    RICH_TEXT_FLUSH_TIMEOUT_MS,
  );
  const runCommand = commands.run;

  const dispatch = (action: PuckAction) => {
    if (getPuck === null) {
      return; // Not ready yet: the Bridge sends the current page once it is.
    }
    if (sync.inAction()) {
      queueMicrotask(() => dispatch(action));
      return;
    }
    const puck = getPuck;
    sync.apply(() => puck().dispatch(action));
  };

  /** The canvas's width, zoom and size (see `canvas-view.ts`). */
  const view = createCanvasView(() => getPuck?.() ?? null, dispatch);

  /** Sends `page` to Puck, unless Puck isn't ready yet (then the Bridge sends it once it is). */
  const showPage = () => {
    if (getPuck !== null) {
      dispatch({
        type: "setData",
        data: () => toPuckData(composePage(page, layout, shared)),
        recordHistory: false,
      });
      sync.shown();
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
  const emitEdit = (edit: EngineEdit) => sync.report(() => edits.emit(edit));

  /**
   * Takes over `routed`, where an edit goes (see `routeEdit`): the page, layout and shared sections
   * with it, the edit reported to the app, and Puck's view put back in step from `shown`.
   */
  const follow = (routed: RoutedEdit, shown: PageDoc) => {
    ({ page, layout, shared } = routed.next);
    if (routed.emit !== undefined) emitEdit(routed.emit);
    putBack(shown, routed.putBack === "whenOutOfOrder");
  };

  /** Reports an edit Puck made to the page as the canvas shows it (see `routeEdit`). */
  const reportEdit = (edit: EngineEdit, action: PuckAction, prev: AppState) =>
    follow(routeEdit(edit, action, prev, { page, layout, shared }), edit.page);

  /** The keys held while dragging on the canvas: Ctrl or Cmd copies (see `drag-copies.ts`). */
  const dragKeys: DragKeys = { copy: false, linked: false, pressed: false };

  /**
   * Carries out a drop with Ctrl or Cmd held (see `planCopyDrop`), once Puck has moved what was
   * dragged (`next`): its view put right, the original back and the copy shown, and the copy
   * reported as one step.
   */
  const copyOnDrop = (
    action: PuckAction,
    drop: Drop,
    next: AppState,
    prev: AppState,
    linked: boolean,
  ) => {
    if (getPuck === null || library === null) return;
    const shown = toPageDoc(next.data);
    const plan = planCopyDrop(drop, linked, prev, { page, layout, shared });
    if (plan.kind === "refuse") {
      putBack(shown);
      return;
    }
    if (plan.kind === "linked") {
      placeLinkedCopy(plan.copy, drop, shown);
    } else {
      const actions = pageActions(shown, plan.after, slotsOf);
      if (actions === null) {
        dispatch({ type: "setData", data: () => toPuckData(plan.after), recordHistory: false });
      } else {
        for (const one of actions) dispatch({ ...one, recordHistory: false });
      }
      reportEdit(plan.edit, action, prev);
    }
    commands.edited();
  };

  /** Another linked copy of `copy`'s section where a drag of it dropped (see `routeLinkedCopy`). */
  const placeLinkedCopy = (copy: NodeDoc & SharedCopyNode, drop: Drop, shown: PageDoc) =>
    follow(routeLinkedCopy(copy, drop, { page, layout, shared }), shown);

  const handleAction = (action: PuckAction, next: AppState, prev: AppState) =>
    sync.handleAction(() => {
      // The echo of Webforge's own dispatch: Puck shows what the app has already.
      if (sync.isEcho()) {
        return;
      }
      const copying = library === null ? null : copyDrop(action, prev, dragKeys);
      if (copying !== null) {
        // Made once Puck has finished its own update, where a dispatch would be lost.
        const { drop, linked } = copying;
        queueMicrotask(() => copyOnDrop(action, drop, next, prev, linked));
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
    });

  const reportSelection = (id: string | null) => {
    if (id !== selection) {
      selection = id;
      const adding = id !== null && id === addingClick;
      addingClick = null;
      selections.emit({ id, adding });
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
      if (!sync.isShown()) {
        showPage();
      }
      // A width set before Puck was ready, or Puck's own starting width.
      view.show();
      // A selection made before Puck was ready. Only when it differs: re-selecting resets Puck's
      // field focus and remounts an open rich-text editor (this effect re-runs on re-renders).
      if ((get().selectedItem?.props.id ?? null) !== selection) {
        dispatch({ type: "setUi", ui: { itemSelector: selectorFor(selection) } });
      }
      return () => {
        getPuck = null;
        view.forgetPending();
        // A remounted Puck starts from whatever `data` it was last rendered with: resend the page.
        sync.forget();
      };
    }, [get]);
    // After the effect above, so the width it sends to Puck isn't taken for the user's choice.
    useEffect(() => {
      view.shown(width);
      view.measure();
    }, [width]);
    // Puck changes the zoom inside its store, where nothing reports it, and shows it on the canvas
    // root's style (its scale and height): watch that.
    useEffect(() => {
      const canvasRoot = host?.querySelector(CANVAS_ROOT);
      if (!canvasRoot) {
        return;
      }
      view.measure();
      const observer = new MutationObserver(view.measure);
      observer.observe(canvasRoot, { attributes: true, attributeFilter: ["style"] });
      return () => {
        observer.disconnect();
        view.stopMeasuring();
      };
    }, []);
    return (
      <>
        {children}
        <dragSources.Portals />
      </>
    );
  }

  /** The quick actions, for the page as it is now (see `action-bar.tsx`). */
  const SharedAwareActionBar = createActionBar({
    docs: () => ({ page, layout, shared }),
    library: () => library,
    document: () => frameDocument ?? host?.ownerDocument,
    request: elementRequests.emit,
    several: { get: () => alsoSelected.length > 0, subscribe: alsoSelectedChanged.add },
  });

  function CanvasFrame({ children, document }: { children: ReactNode; document?: Document }) {
    useEffect(() => {
      frameDocument = document ?? null;
      if (document !== undefined) {
        applyChromeStyles(document);
        if (siteStyles !== null) applySiteStyles(document, siteStyles);
        showAlsoSelected(document, alsoSelected);
      }
      followMode();
      followViewOptions();
      const frameWindow = document?.defaultView;
      if (!frameWindow) {
        return undefined;
      }
      frameWindows.emit(frameWindow);
      const removeKeys = installHistoryKeys(frameWindow, runCommand);
      const showDeleteKeys = hidePuckDeleteKeys(frameWindow);
      const stopDragKeys = trackDragKeys(frameWindow, dragKeys);
      // The element menu, but not in Content mode, where right-clicks get the browser's own.
      const stopClicks = watchClicks(frameWindow);
      const removeMenu = installContextMenu(frameWindow.document, contextMenus.emit, {
        enabled: () => mode === "design",
        selected: () => selection,
      });
      // Shift+F10 on macOS too (#287).
      const removeMenuKeys = installMenuKeys(frameWindow.document);
      return () => {
        showDeleteKeys();
        stopDragKeys();
        removeMenu();
        removeMenuKeys();
        stopClicks();
        stopKeepingEnabled?.();
        stopKeepingEnabled = null;
        stopViewOptions?.();
        stopViewOptions = null;
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
    componentOverlay: createSelectionOutline(
      (at) =>
        // The floating + counts the Header's nodes; the app adds to the page's own content.
        addRequests.emit({
          index: Math.min(Math.max(at.index - layout.header.length, 0), page.content.length),
        }),
      {
        fieldsOf: (componentType) => boxHandleFields(library, componentType),
        onFieldDrag: fieldDrags.emit,
      },
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
  const pickLink = (): PickLink | null => {
    const picker = linkPicker;
    return picker === null ? null : (current) => picker(current, editingRichText());
  };
  const richTextTools = {
    toolbar: createFormatToolbar(pickLink),
    // Mod + K, Alt + Enter and Shift + Space in rich text (F-ED-27).
    extensions: [
      createTextKeys({
        pickLink,
        split: (halves) => {
          const at = editingRichText();
          // After the last keystrokes Puck still holds back, so the step before the split has them
          // and undoing the split gives back all that was typed.
          if (at !== null) commands.whenSent(() => textSplits.emit({ ...at, ...halves }));
        },
      }),
    ],
  };

  /** The Puck config for `library`, rendering with the current editor revisions and context. */
  const configFor = (forLibrary: ComponentLibrary) =>
    toPuckConfig(
      forLibrary,
      (id) => editorRevisions.get(id) ?? 0,
      () => renderContext,
      richTextTools,
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
      <ErrorBoundary>
        <Puck
          config={config}
          data={toPuckData(composePage(page, layout, shared))}
          onAction={handleAction}
          dictionary={dictionary}
          overrides={overrides}
          iframe={iframe}
          // The editor's own Edit panel shows the fields (1.14), not Puck's right sidebar; its Add
          // panel (1.13) and Layers (1.24) replace Puck's left one, and its rail is hidden (#274).
          ui={{
            leftSideBarVisible: false,
            rightSideBarVisible: false,
            // Puck starts with the app's width; without one it picks the view nearest the window's.
            viewports: {
              current: { width: view.width(), height: "auto" },
              options: [],
              // The canvas toolbar chooses the view and zoom (1.15), not Puck's own controls.
              controlsVisible: false,
            },
          }}
          viewports={viewportOptions}
          height="100%"
          permissions={mode === "content" ? CONTENT_MODE_PERMISSIONS : DESIGN_MODE_PERMISSIONS}
        />
      </ErrorBoundary>,
    );
  };

  return {
    mount(el, opts) {
      if (root !== null) {
        throw new Error("The canvas engine is already mounted");
      }
      host = el;
      // Only Puck's canvas shows: the editor has its own Add, Layers and Edit panels (#274).
      hidePuckLayout(el);
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
      const hostWindow = el.ownerDocument.defaultView;
      stopHidingHostKeys = hostWindow === null ? null : hidePuckDeleteKeys(hostWindow);
      stopTrackingHostKeys = hostWindow === null ? null : trackDragKeys(hostWindow, dragKeys);
      stopHostClicks = hostWindow === null ? null : watchClicks(hostWindow);
      ErrorBoundary = opts.errorBoundary ?? NoBoundary;
      const { onError } = opts;
      // Each error in the canvas's own React root goes to `onError`; React's defaults otherwise.
      root = createRoot(
        el,
        onError === undefined
          ? {}
          : {
              onCaughtError: (error) => onError(error, true),
              onUncaughtError: (error) => onError(error, false),
            },
      );
      render();
      // Puck starts with the current page.
      sync.shown();
    },

    loadPage(nextPage, nextLayout, nextShared = {}) {
      page = nextPage;
      layout = nextLayout;
      shared = nextShared;
      sync.changed();
      editorRevisions.clear();
      reportSelection(null);
      showPage();
      dispatch({ type: "setUi", ui: { itemSelector: null } });
    },

    applyChange({ page: nextPage, layout: nextLayout = layout, shared: nextShared = shared }) {
      if (sync.isReporting()) {
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
        getPuck !== null && sync.isShown() ? pageActions(before, after, slotsOf) : null;
      page = nextPage;
      layout = nextLayout;
      shared = nextShared;
      sync.changed();
      preserveCaret(frameDocument);
      if (refocus !== null) refocusRichText(frameDocument, refocus);
      if (actions === null) {
        showPage();
      } else {
        for (const action of actions) dispatch({ ...action, recordHistory: false });
        sync.shown();
      }
      // Puck selects by position; keep the same element selected, or none if it is gone.
      if (selection !== null && findNode(after, selection) === undefined) {
        selection = null;
        selections.emit({ id: null, adding: false });
      }
      dispatch({ type: "setUi", ui: { itemSelector: selectorFor(selection) } });
    },

    onUserEdit: edits.add,
    onSelectionChange: (cb) => selections.add(({ id, adding }) => cb(id, adding)),

    showSelected(others) {
      alsoSelected = others;
      const doc = frameDocument ?? host?.ownerDocument;
      if (doc !== undefined) showAlsoSelected(doc, others);
      alsoSelectedChanged.emit();
    },
    onHistoryCommand(handler) {
      commandHandlers.add(handler);
      return () => {
        commandHandlers.delete(handler);
      };
    },

    outline(nodeId) {
      const doc = frameDocument ?? host?.ownerDocument;
      for (const element of doc?.querySelectorAll(`[${OUTLINED_ATTRIBUTE}]`) ?? []) {
        element.removeAttribute(OUTLINED_ATTRIBUTE);
      }
      if (nodeId === null) return;
      doc?.querySelector(componentSelector(nodeId))?.setAttribute(OUTLINED_ATTRIBUTE, "");
    },

    select(nodeId) {
      if (nodeId === selection) {
        return;
      }
      selection = nodeId;
      dispatch({ type: "setUi", ui: { itemSelector: selectorFor(nodeId) } });
    },

    setViewport: view.setViewport,
    onViewportChange: view.onViewport,

    setImages(image) {
      renderContext = { ...renderContext, image };
      redraw();
    },

    setNavigation(navigation) {
      renderContext = { ...renderContext, navigation };
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

    setZoom: view.zoom,
    onCanvasSize: view.onSize,

    setSiteCss(css, bodyClass) {
      siteStyles = { css, bodyClass };
      if (frameDocument !== null) {
        applySiteStyles(frameDocument, siteStyles);
      }
    },

    perform(action) {
      const puck = getPuck;
      const doc = frameDocument ?? host?.ownerDocument;
      if (puck === null || sync.inAction()) {
        return false;
      }
      if (action === "editText" || action === "clearText") {
        // The text of the element selected now, on the canvas (F-ED-27).
        const id = puck().selectedItem?.props.id;
        return (
          typeof id === "string" &&
          doc !== undefined &&
          startTextEditing(doc, id, action === "clearText")
        );
      }
      if (!performOnSelected(puck(), action)) {
        return false;
      }
      if (action.startsWith("select")) {
        // Walking through a long page from the keyboard keeps the selection in view.
        const id = puck().selectedItem?.props.id;
        const element = id === undefined ? null : doc?.querySelector(componentSelector(id));
        element?.scrollIntoView?.({ block: "nearest" });
      }
      return true;
    },

    onAddRequest: addRequests.add,

    onElementRequest: elementRequests.add,
    onTextSplit: textSplits.add,

    onFieldDrag: fieldDrags.add,

    onContextMenu: contextMenus.add,

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
      followMode();
      render();
    },

    setViewOptions(options) {
      viewOptions = options;
      followViewOptions();
    },

    renderStatic(staticPage, staticLayout, staticShared = {}, context = EDITOR_RENDER_CONTEXT) {
      if (library === null) {
        throw new Error("Mount the canvas engine before rendering pages");
      }
      // The export's renderer (ADR 0005), linked copies inline as their shared sections (F-ED-23).
      const regions = {
        header: staticLayout.header,
        content: expandSharedCopies(staticPage.content, staticShared),
        footer: staticLayout.footer,
      };
      const { header, main, footer } = renderPage(regions, library, context);
      return `${header}${main}${footer}`;
    },

    destroy() {
      // An Undo still waiting for its rich-text edit goes with the canvas.
      commands.dispose();
      const mounted = root;
      const element = host;
      root = null;
      host = null;
      getPuck = null;
      stopHidingHostKeys?.();
      stopHidingHostKeys = null;
      stopTrackingHostKeys?.();
      stopTrackingHostKeys = null;
      stopHostClicks?.();
      stopHostClicks = null;
      frameDocument = null;
      // Unmount after the current render: the app destroys the engine from an effect cleanup.
      queueMicrotask(() => {
        mounted?.unmount();
        element?.replaceChildren();
      });
    },
  };
}
