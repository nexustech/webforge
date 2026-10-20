import {
  type CanvasEngine,
  createPuckEngine,
  type HistoryCommand,
  installHistoryKeys,
} from "@webforge/engine";
import { t } from "@webforge/i18n";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { useCommandRegistry } from "../shell/command-context.js";
import { COMMAND_IDS } from "../shell/command-ids.js";
import {
  connectEngine,
  currentPage,
  type EditorSession,
  type EngineConnection,
  runHistoryCommand,
} from "./editor-session.js";
import { type CompileCanvasCss, connectSiteCss } from "./site-css.js";
import { UndoHistoryPanel } from "./UndoHistoryPanel.js";

/** Props of {@link Editor}. */
export type EditorProps = {
  readonly session: EditorSession;
  /** Creates the canvas engine; injectable for tests. */
  readonly createEngine?: () => CanvasEngine;
  /** Compiles the site CSS for the canvas; injectable for tests. Defaults to the preload API. */
  readonly compileCss?: CompileCanvasCss;
};

const compileWithPreload: CompileCanvasCss = (request) =>
  window.webforge.canvas.compileCss(request);

/** The site editor: toolbar, canvas and Undo History panel around one {@link EditorSession}. */
export function Editor({
  session,
  createEngine = createPuckEngine,
  compileCss = compileWithPreload,
}: EditorProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const connectionRef = useRef<EngineConnection | null>(null);
  const { history } = session;
  const state = useSyncExternalStore(
    history.state.subscribe,
    history.state.getState,
    history.state.getState,
  );

  useEffect(() => {
    const container = canvasRef.current;
    if (container === null) {
      return;
    }
    // A fresh element per mount, so React's StrictMode remount never reuses an unmounting root.
    const element = document.createElement("div");
    element.className = "editor__canvas-root";
    container.append(element);

    const engine = createEngine();
    const site = history.document.getState();
    engine.mount(element, { library: session.library, theme: site.theme });
    const page = currentPage(session);
    if (page !== undefined) {
      engine.loadPage(page.doc, site.layout);
    }
    const connection = connectEngine(engine, session);
    connectionRef.current = connection;
    const stopSiteCss = connectSiteCss(engine, session, compileCss, document.baseURI);
    // One handler for the whole window (U4); the engine reports keys pressed inside its iframe.
    const removeKeys = installHistoryKeys(window, (command) => {
      connection.flush();
      return runHistoryCommand(session, command);
    });

    return () => {
      stopSiteCss();
      removeKeys();
      connectionRef.current = null;
      connection.disconnect();
      engine.destroy();
      element.remove();
    };
  }, [session, history, createEngine, compileCss]);

  // Undo and Redo live in the title bar, the Edit menu and the command box (1.2).
  const registry = useCommandRegistry();
  useEffect(() => {
    const runCommand = (command: HistoryCommand) => {
      connectionRef.current?.flush();
      runHistoryCommand(session, command);
    };
    const removeUndo = registry.register({
      id: COMMAND_IDS.undo,
      label: t("editor.undo"),
      menu: "edit",
      shortcut: "Mod+Z",
      enabled: history.state.getState().canUndo,
      run: () => runCommand("undo"),
    });
    const removeRedo = registry.register({
      id: COMMAND_IDS.redo,
      label: t("editor.redo"),
      menu: "edit",
      shortcut: "Mod+Shift+Z",
      enabled: history.state.getState().canRedo,
      run: () => runCommand("redo"),
    });
    return () => {
      removeUndo();
      removeRedo();
    };
  }, [registry, session, history]);
  useEffect(() => {
    registry.update(COMMAND_IDS.undo, { enabled: state.canUndo });
    registry.update(COMMAND_IDS.redo, { enabled: state.canRedo });
  }, [registry, state.canUndo, state.canRedo]);

  const jumpTo = (entryId: string | null) => {
    connectionRef.current?.flush();
    return history.jumpTo(entryId);
  };

  return (
    <div className="editor">
      <section className="editor__canvas" aria-label={t("editor.canvas")} ref={canvasRef} />
      <UndoHistoryPanel history={{ jumpTo }} state={state} />
    </div>
  );
}
