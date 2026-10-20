import {
  type CanvasEngine,
  createPuckEngine,
  type HistoryCommand,
  installHistoryKeys,
} from "@webforge/engine";
import { t } from "@webforge/i18n";
import { useEffect, useRef, useSyncExternalStore } from "react";
import {
  connectEngine,
  currentPage,
  type EditorSession,
  type EngineConnection,
  runHistoryCommand,
} from "./editor-session.js";
import { UndoHistoryPanel } from "./UndoHistoryPanel.js";

/** Props of {@link Editor}. */
export type EditorProps = {
  readonly session: EditorSession;
  /** Creates the canvas engine; injectable for tests. */
  readonly createEngine?: () => CanvasEngine;
};

/** The site editor: toolbar, canvas and Undo History panel around one {@link EditorSession}. */
export function Editor({ session, createEngine = createPuckEngine }: EditorProps) {
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
    // One handler for the whole window (U4); the engine reports keys pressed inside its iframe.
    const removeKeys = installHistoryKeys(window, (command) => {
      connection.flush();
      return runHistoryCommand(session, command);
    });

    return () => {
      removeKeys();
      connectionRef.current = null;
      connection.disconnect();
      engine.destroy();
      element.remove();
    };
  }, [session, history, createEngine]);

  const runCommand = (command: HistoryCommand) => {
    connectionRef.current?.flush();
    runHistoryCommand(session, command);
  };
  const jumpTo = (entryId: string | null) => {
    connectionRef.current?.flush();
    return history.jumpTo(entryId);
  };

  return (
    <div className="editor">
      <div className="editor__toolbar">
        <button type="button" disabled={!state.canUndo} onClick={() => runCommand("undo")}>
          {t("editor.undo")}
        </button>
        <button type="button" disabled={!state.canRedo} onClick={() => runCommand("redo")}>
          {t("editor.redo")}
        </button>
      </div>
      <section className="editor__canvas" aria-label={t("editor.canvas")} ref={canvasRef} />
      <UndoHistoryPanel history={{ jumpTo }} state={state} />
    </div>
  );
}
