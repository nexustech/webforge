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
import type { PageDoc } from "@webforge/model";
import type { ComponentLibrary } from "@webforge/site-components";
import { type ReactNode, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import type {
  CanvasEngine,
  EditorMode,
  EngineEdit,
  HistoryCommand,
  Viewport,
} from "../canvas-engine.js";
import { installHistoryKeys } from "../history-keys.js";
import { preserveCaret } from "./caret.js";
import { toPuckConfig } from "./config.js";
import { isDeepEqual } from "./deep-equal.js";
import { editFromAction, selectedNodeId, toPageDoc } from "./edit-from-action.js";
import { staleRichText } from "./stale-rich-text.js";
import { allNodes, findNode } from "./tree.js";

/** Options of {@link createPuckEngine}. */
export type PuckEngineOptions = {
  /** Render the canvas in an iframe (default). Tests without layout may turn it off. */
  readonly iframe?: boolean;
};

const VIEWPORT_WIDTHS = { desktop: 1280, tablet: 768, mobile: 375 } as const;

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
 * - undo, redo and jumps come back through `applyChange` as `setData` with `recordHistory: false`;
 * - Puck's header (with its Undo/Redo buttons) is replaced, and its Ctrl/Cmd+Z hotkeys never fire
 *   because {@link installHistoryKeys} takes those keys first, in the host and in the iframe.
 */
export function createPuckEngine(options: PuckEngineOptions = {}): CanvasEngine {
  let root: Root | null = null;
  let host: HTMLElement | null = null;
  let library: ComponentLibrary | null = null;
  let config: Config | null = null;
  let getPuck: GetPuck | null = null;
  /** The page as Puck shows it. */
  let page: PageDoc = EMPTY_PAGE;
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
  /** Per node, bumped to remount its rich-text editors (see toPuckConfig). */
  const editorRevisions = new Map<string, number>();

  const edits = emitter<EngineEdit>();
  const selections = emitter<string | null>();
  const commands = emitter<HistoryCommand>();

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

  const selectorFor = (id: string | null) =>
    id === null ? null : (getPuck?.().getSelectorForId(id) ?? null);

  const handleAction = (action: PuckAction, next: AppState, prev: AppState) => {
    inAction = true;
    try {
      if (applying) {
        page = toPageDoc(next.data);
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
    useEffect(() => {
      getPuck = get;
      if (!isDeepEqual(toPageDoc(get().appState.data), page)) {
        dispatch({ type: "setData", data: () => toPuckData(page), recordHistory: false });
      }
      // A selection made before Puck was ready. Only when it differs: re-selecting resets Puck's
      // field focus and remounts an open rich-text editor (this effect re-runs on re-renders).
      if ((get().selectedItem?.props.id ?? null) !== selection) {
        dispatch({ type: "setUi", ui: { itemSelector: selectorFor(selection) } });
      }
      return () => {
        getPuck = null;
      };
    }, [get]);
    return <>{children}</>;
  }

  function CanvasFrame({ children, document }: { children: ReactNode; document?: Document }) {
    useEffect(() => {
      frameDocument = document ?? null;
      const frameWindow = document?.defaultView;
      return frameWindow ? installHistoryKeys(frameWindow, commands.emit) : undefined;
    }, [document]);
    return <>{children}</>;
  }

  const overrides: Partial<Overrides> = {
    // Replaces Puck's header, which holds Puck's own Undo/Redo buttons.
    header: () => <></>,
    puck: Bridge,
    iframe: CanvasFrame,
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
        overrides={overrides}
        iframe={{ enabled: options.iframe ?? true, syncHostStyles: false }}
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
      config = toPuckConfig(opts.library, (id) => editorRevisions.get(id) ?? 0);
      root = createRoot(el);
      render();
    },

    loadPage(nextPage) {
      page = nextPage;
      editorRevisions.clear();
      reportSelection(null);
      dispatch({ type: "setData", data: () => toPuckData(nextPage), recordHistory: false });
      dispatch({ type: "setUi", ui: { itemSelector: null } });
    },

    applyChange({ page: nextPage }) {
      if (reporting) {
        // The document store just took over the edit Puck reported: same content, nothing to show.
        page = nextPage;
        return;
      }
      if (nextPage === page || isDeepEqual(nextPage, page)) {
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
      page = nextPage;
      preserveCaret(frameDocument);
      dispatch({ type: "setData", data: () => toPuckData(nextPage), recordHistory: false });
      // Puck selects by position; keep the same element selected, or none if it is gone.
      if (selection !== null && findNode(nextPage, selection) === undefined) {
        selection = null;
        selections.emit(null);
      }
      dispatch({ type: "setUi", ui: { itemSelector: selectorFor(selection) } });
    },

    onUserEdit: edits.add,
    onSelectionChange: selections.add,
    onHistoryCommand: commands.add,

    select(nodeId) {
      if (nodeId === selection) {
        return;
      }
      selection = nodeId;
      dispatch({ type: "setUi", ui: { itemSelector: selectorFor(nodeId) } });
    },

    setViewport(viewport: Viewport) {
      const width = typeof viewport === "number" ? viewport : VIEWPORT_WIDTHS[viewport];
      dispatch({
        type: "setUi",
        ui: (ui) => ({ viewports: { ...ui.viewports, current: { width, height: "auto" } } }),
      });
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
