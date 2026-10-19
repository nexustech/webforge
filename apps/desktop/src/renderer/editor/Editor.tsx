import { type CanvasEngine, createPuckEngine, installHistoryKeys } from "@webforge/engine";
import { t } from "@webforge/i18n";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { connectEngine, type EditorSession, runHistoryCommand } from "./editor-session.js";
import { UndoHistoryPanel } from "./UndoHistoryPanel.js";

/** Props of {@link Editor}. */
export type EditorProps = {
  readonly session: EditorSession;
  /** Creates the canvas engine; injectable for tests. */
  readonly createEngine?: () => CanvasEngine;
};

const SPIKE_THEME = { name: "default" } as const;
const NO_LAYOUT = { header: [], footer: [] };

/** The page editor: toolbar, canvas and Undo History panel around one {@link EditorSession}. */
export function Editor({ session, createEngine = createPuckEngine }: EditorProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
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
    engine.mount(element, { library: session.library, theme: SPIKE_THEME });
    engine.loadPage(history.document.getState().page, NO_LAYOUT);
    const disconnect = connectEngine(engine, session);
    // One handler for the whole window (U4); the engine reports keys pressed inside its iframe.
    const removeKeys = installHistoryKeys(window, (command) => runHistoryCommand(history, command));

    return () => {
      removeKeys();
      disconnect();
      engine.destroy();
      element.remove();
    };
  }, [session, history, createEngine]);

  return (
    <div className="editor">
      <div className="editor__toolbar">
        <button type="button" disabled={!state.canUndo} onClick={() => history.undo()}>
          {t("editor.undo")}
        </button>
        <button type="button" disabled={!state.canRedo} onClick={() => history.redo()}>
          {t("editor.redo")}
        </button>
      </div>
      <section className="editor__canvas" aria-label={t("editor.canvas")} ref={canvasRef} />
      <UndoHistoryPanel history={history} state={state} />
    </div>
  );
}
