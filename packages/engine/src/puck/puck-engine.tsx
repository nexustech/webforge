import { type Config, Puck, type PuckAction, type useGetPuck } from "@puckeditor/core";
// Puck's default stylesheet loads the Inter font from rsms.me; Webforge makes no external requests.
import "@puckeditor/core/no-external.css";
import {
  type ComponentLibrary,
  EDITOR_RENDER_CONTEXT,
  type RenderContext,
  samePreviews,
} from "@webforge/site-components";
import type { ComponentType, ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import type {
  CanvasContextMenu,
  CanvasEngine,
  ElementRequest,
  FieldDrag,
  HistoryCommandHandler,
  InsertPoint,
  TextSplit,
} from "../canvas-engine.js";
import { installHistoryKeys } from "../history-keys.js";
import { createCanvasFrame } from "./canvas-frame.js";
import { listenInEditor } from "./canvas-listeners.js";
import { createCanvasPage } from "./canvas-page.js";
import { createCanvasSelection } from "./canvas-selection.js";
import { createCanvasSync } from "./canvas-sync.js";
import { createCanvasView } from "./canvas-view.js";
import { preserveCaret } from "./caret.js";
import { outlineElement } from "./chrome.js";
import { toPuckConfig } from "./config.js";
import { deferredCommands } from "./deferred-commands.js";
import { puckDictionary } from "./dictionary.js";
import type { DragKeys } from "./drag-copies.js";
import { createDragSources } from "./drag-sources.js";
import { elementNames } from "./element-names.js";
import {
  CONTENT_MODE_PERMISSIONS,
  DESIGN_MODE_PERMISSIONS,
  emitter,
  flushRichText,
  memoByDocs,
  NoBoundary,
  puckViewports,
  RICH_TEXT_FLUSH_TIMEOUT_MS,
  toPuckData,
} from "./engine-support.js";
import { hidePuckLayout } from "./layout-styles.js";
import type { SlotsOf } from "./page-actions.js";
import { createPuckOverrides } from "./puck-overrides.js";
import { createRichTextTools } from "./rich-text-tools.js";
import type { CanvasDocs } from "./route-edit.js";
import { performOnCanvas } from "./selected-actions.js";
import { richTextArrived } from "./stale-rich-text.js";
import { typingPauses } from "./typing-pauses.js";

/** Options of {@link createPuckEngine}. */
export type PuckEngineOptions = {
  /** Render the canvas in an iframe (default). Tests without layout may turn it off. */
  readonly iframe?: boolean;
};

type GetPuck = ReturnType<typeof useGetPuck>;

/**
 * The Puck implementation of {@link CanvasEngine}: the wiring of the canvas's parts (R8).
 *
 * Puck stays in charge of drag-and-drop, selection and inline editing, but not of history:
 * - every user action arrives through `onAction` and is reported as an `EngineEdit` (see
 *   `canvas-page.ts`);
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
  const puck = () => getPuck?.() ?? null;
  /** Which page Puck shows, and whose change is under way (see `canvas-sync.ts`). */
  const sync = createCanvasSync();
  /** Stops listening in the editor window (see `listenInEditor`). */
  let stopEditorListeners: (() => void) | null = null;
  /** What the canvas renders with: no navigation or links, and the site's Media images. */
  let renderContext: RenderContext = EDITOR_RENDER_CONTEXT;
  /** Per node, bumped to remount its rich-text editors (see toPuckConfig). */
  const editorRevisions = new Map<string, number>();

  const addRequests = emitter<InsertPoint>();
  const fieldDrags = emitter<FieldDrag>();
  const elementRequests = emitter<ElementRequest>();
  const textSplits = emitter<TextSplit>();
  const contextMenus = emitter<CanvasContextMenu>();
  const frameWindows = emitter<Window | null>();
  const dragSources = createDragSources(
    (componentType) => library?.components[componentType]?.label ?? componentType,
  );

  const dispatch = (action: PuckAction) => {
    if (getPuck === null) {
      return; // Not ready yet: the Bridge sends the current page once it is.
    }
    if (sync.inAction()) {
      queueMicrotask(() => dispatch(action));
      return;
    }
    const get = getPuck;
    sync.apply(() => get().dispatch(action));
  };

  const selection = createCanvasSelection(dispatch, (id) => puck()?.getSelectorForId(id) ?? null);

  /** The names the View menu's labels show, by id, for the page shown: made once per change. */
  const names = memoByDocs((docs: CanvasDocs) => elementNames(docs, library));
  const frame = createCanvasFrame((id) => names(page.docs()).get(id));

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
    () => richTextArrived(frame.document(), page.composed(), getPuck?.().appState.ui.field.focus),
    RICH_TEXT_FLUSH_TIMEOUT_MS,
  );
  const pauses = typingPauses();
  /** The keys held while dragging on the canvas: Ctrl or Cmd copies (see `drag-copies.ts`). */
  const dragKeys: DragKeys = { copy: false, linked: false, pressed: false };

  /** The page and its shared parts, as the app and Puck both see them (see `canvas-page.ts`). */
  const page = createCanvasPage({
    sync,
    puck,
    dispatch,
    library: () => library,
    slotsOf: (type) => slotsOf(type),
    selection,
    commands,
    pauses,
    dragKeys,
    editorRevisions,
    frameDocument: frame.document,
  });

  /** The canvas's width, zoom and size (see `canvas-view.ts`). */
  const view = createCanvasView(puck, dispatch);

  const overrides = createPuckOverrides({
    sync,
    view,
    page,
    selection,
    frame,
    setPuck: (get) => {
      getPuck = get;
    },
    host: () => host,
    library: () => library,
    dragSources,
    frameListeners: {
      dragKeys,
      watchClicks: selection.watchClicks,
      runCommand: commands.run,
      pauses,
      contextMenu: contextMenus.emit,
      menuEnabled: () => frame.mode() === "design",
      selected: selection.current,
    },
    frameWindows,
    addRequest: addRequests.emit,
    elementRequest: elementRequests.emit,
    fieldDrag: fieldDrags.emit,
  });

  const dictionary = puckDictionary();
  // Kept, not rebuilt per render: Puck resets the canvas width whenever these change.
  const iframe = { enabled: options.iframe ?? true, syncHostStyles: false };
  const viewportOptions = puckViewports();

  /** The format toolbar and text keys of rich text on the canvas (see `rich-text-tools.ts`). */
  const richText = createRichTextTools(puck, textSplits.emit, commands.whenSent);

  /** The Puck config for `library`, rendering with the current editor revisions and context. */
  const configFor = (forLibrary: ComponentLibrary) =>
    toPuckConfig(
      forLibrary,
      (id) => editorRevisions.get(id) ?? 0,
      () => renderContext,
      richText.tools,
    );

  /**
   * Draws the page again with the current render context. Puck draws a component again only when
   * its props or its config change, and an image or a Site Settings value can change without any
   * props changing (deleted from Media, cropped, renamed): give Puck a new config.
   */
  const redraw = () => {
    if (library !== null) {
      config = configFor(library);
      preserveCaret(frame.document());
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
          data={toPuckData(page.composed())}
          onAction={page.handleAction}
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
          permissions={
            frame.mode() === "content" ? CONTENT_MODE_PERMISSIONS : DESIGN_MODE_PERMISSIONS
          }
        />
      </ErrorBoundary>,
    );
  };

  /** The canvas's document: the iframe's, or the editor's without one. */
  const canvasDocument = () => frame.document() ?? host?.ownerDocument;

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
      const editorWindow = el.ownerDocument.defaultView;
      stopEditorListeners =
        editorWindow === null
          ? null
          : listenInEditor(editorWindow, { dragKeys, watchClicks: selection.watchClicks });
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

    loadPage: (nextPage, nextLayout, nextShared = {}) =>
      page.load({ page: nextPage, layout: nextLayout, shared: nextShared }),

    applyChange({ page: nextPage, layout, shared }) {
      const docs = page.docs();
      page.apply({ page: nextPage, layout: layout ?? docs.layout, shared: shared ?? docs.shared });
    },

    onUserEdit: page.onEdit,
    onSelectionChange: selection.onChange,

    showSelected: (others) => selection.showOthers(others, canvasDocument()),
    onHistoryCommand(handler) {
      commandHandlers.add(handler);
      return () => {
        commandHandlers.delete(handler);
      };
    },

    outline: (nodeId) => outlineElement(canvasDocument(), nodeId),

    select: selection.select,

    setViewport: view.setViewport,
    onViewportChange: view.onViewport,

    setImages(image, emptyImage) {
      const { emptyImage: _previous, ...rest } = renderContext;
      renderContext = { ...rest, image, ...(emptyImage === undefined ? {} : { emptyImage }) };
      redraw();
    },

    setNavigation(navigation) {
      renderContext = { ...renderContext, navigation };
      redraw();
    },

    setLinkPicker: richText.setLinkPicker,

    setSettings(bindings) {
      // Replaces every binding: one left out of `bindings` goes. The context's other parts are named
      // here; a required part added to RenderContext fails to compile until it's listed, an optional
      // one would be dropped silently, so list it too.
      const { navigation, link, href, image } = renderContext;
      renderContext = { navigation, link, href, image, ...bindings };
      redraw();
    },

    setZoom: view.zoom,
    onCanvasSize: view.onSize,

    setSiteCss: (css, bodyClass) => frame.setSiteStyles({ css, bodyClass }),

    perform: (action) =>
      getPuck !== null && !sync.inAction() && performOnCanvas(getPuck(), canvasDocument(), action),

    onAddRequest: addRequests.add,

    onElementRequest: elementRequests.add,
    onTextSplit: textSplits.add,

    onFieldDrag: fieldDrags.add,

    onContextMenu: contextMenus.add,

    addDragSource: dragSources.add,

    onFrameWindow(cb) {
      const current = frame.document()?.defaultView;
      if (current) {
        cb(current);
      }
      return frameWindows.add(cb);
    },

    setMode(nextMode) {
      frame.setMode(nextMode);
      render();
    },

    setViewOptions: frame.setViewOptions,

    setPreviews(previews) {
      // Drawing the page again is only worth it when what it previews changes.
      if (samePreviews(renderContext.previews ?? {}, previews)) return;
      renderContext = { ...renderContext, previews };
      redraw();
    },

    destroy() {
      // An Undo still waiting for its rich-text edit goes with the canvas.
      commands.dispose();
      const mounted = root;
      const element = host;
      root = null;
      host = null;
      getPuck = null;
      stopEditorListeners?.();
      stopEditorListeners = null;
      frame.forget();
      // Unmount after the current render: the app destroys the engine from an effect cleanup.
      queueMicrotask(() => {
        mounted?.unmount();
        element?.replaceChildren();
      });
    },
  };
}
