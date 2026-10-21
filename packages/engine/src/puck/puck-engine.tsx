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
import type { PageDoc } from "@webforge/model";
import type { ComponentLibrary } from "@webforge/site-components";
import { type ReactNode, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import type {
  CanvasEngine,
  EditorMode,
  EngineEdit,
  HistoryCommandHandler,
  InsertPoint,
  Viewport,
} from "../canvas-engine.js";
import { installHistoryKeys } from "../history-keys.js";
import { preserveCaret } from "./caret.js";
import { applyChromeStyles, createSelectionOutline, QuickActionBar } from "./chrome.js";
import { toPuckConfig } from "./config.js";
import { puckDictionary } from "./dictionary.js";
import { editFromAction, selectedNodeId } from "./edit-from-action.js";
import { pageActions, type SlotsOf } from "./page-actions.js";
import { performOnSelected } from "./selected-actions.js";
import { applySiteStyles, type SiteStyles } from "./site-styles.js";
import { staleRichText } from "./stale-rich-text.js";
import { allNodes, findNode } from "./tree.js";

/** Options of {@link createPuckEngine}. */
export type PuckEngineOptions = {
  /** Render the canvas in an iframe (default). Tests without layout may turn it off. */
  readonly iframe?: boolean;
};

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
  /** The canvas width Puck shows, or is about to show. */
  let viewportWidth: number = VIEWPORT_WIDTHS.desktop;
  /** A width the app gave Puck that Puck doesn't show yet: until it does, no width is reported. */
  let pendingWidth: number | null = null;
  /** Per node, bumped to remount its rich-text editors (see toPuckConfig). */
  const editorRevisions = new Map<string, number>();

  const edits = emitter<EngineEdit>();
  const addRequests = emitter<InsertPoint>();
  const frameWindows = emitter<Window | null>();
  const selections = emitter<string | null>();
  const viewports = emitter<Viewport>();
  const commandHandlers = new Set<HistoryCommandHandler>();
  /** True if any handler did something with the command (see installHistoryKeys). */
  const runCommand: HistoryCommandHandler = (command) => {
    let handled = false;
    for (const handler of commandHandlers) handled = handler(command) === true || handled;
    return handled;
  };

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
      dispatch({ type: "setData", data: () => toPuckData(page), recordHistory: false });
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

  const handleAction = (action: PuckAction, next: AppState, prev: AppState) => {
    inAction = true;
    try {
      if (applying) {
        return;
      }
      if (library !== null) {
        const edit = editFromAction(action, next, prev, library);
        if (edit !== null) {
          page = edit.page;
          reporting = true;
          try {
            edits.emit(edit);
          } finally {
            reporting = false;
          }
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
    useEffect(() => reportViewport(width), [width]);
    return <>{children}</>;
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
    componentOverlay: createSelectionOutline(addRequests.emit),
    actionBar: QuickActionBar,
  };

  const render = () => {
    if (root === null || config === null) {
      return;
    }
    root.render(
      <Puck
        config={config}
        data={toPuckData(page)}
        onAction={handleAction}
        dictionary={dictionary}
        overrides={overrides}
        iframe={iframe}
        // The editor's own Edit panel shows the fields (1.14), not Puck's right sidebar.
        ui={{
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
      config = toPuckConfig(opts.library, (id) => editorRevisions.get(id) ?? 0);
      root = createRoot(el);
      render();
      // Puck starts with the current page.
      shownRevision = revision;
    },

    loadPage(nextPage) {
      page = nextPage;
      revision++;
      editorRevisions.clear();
      reportSelection(null);
      showPage();
      dispatch({ type: "setUi", ui: { itemSelector: null } });
    },

    applyChange({ page: nextPage }) {
      if (reporting) {
        // The document store just took over the edit Puck reported: same content, nothing to show.
        page = nextPage;
        return;
      }
      if (nextPage === page) {
        return;
      }
      if (library !== null) {
        for (const id of staleRichText(library, page, nextPage, frameDocument)) {
          editorRevisions.set(id, (editorRevisions.get(id) ?? 0) + 1);
        }
        const ids = new Set(allNodes(nextPage).map((node) => node.props.id));
        for (const id of editorRevisions.keys()) {
          if (!ids.has(id)) editorRevisions.delete(id);
        }
      }
      // Only what changed, unless Puck shows an older page or the change is too big to translate.
      const actions =
        getPuck !== null && shownRevision === revision
          ? pageActions(page, nextPage, slotsOf)
          : null;
      page = nextPage;
      revision++;
      preserveCaret(frameDocument);
      if (actions === null) {
        showPage();
      } else {
        for (const action of actions) dispatch({ ...action, recordHistory: false });
        shownRevision = revision;
      }
      // Puck selects by position; keep the same element selected, or none if it is gone.
      if (selection !== null && findNode(nextPage, selection) === undefined) {
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

    renderStatic(staticPage) {
      if (config === null) {
        throw new Error("Mount the canvas engine before rendering pages");
      }
      return renderToStaticMarkup(<Render config={config} data={toPuckData(staticPage)} />);
    },

    destroy() {
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
