import { toast } from "@webforge/editor-ui";
import {
  type CanvasEngine,
  createPuckEngine,
  type EditorMode,
  type HistoryCommand,
  installHistoryKeys,
} from "@webforge/engine";
import { t } from "@webforge/i18n";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { Preferences } from "../../shared/ipc-contract.js";
import { type AddPanelRegistration, registerAddPanel } from "../add/register-add-panel.js";
import {
  preloadClipboard,
  registerClipboardCommands,
} from "../clipboard/register-clipboard-commands.js";
import { registerLinkField } from "../links/LinkField.js";
import { connectCanvasImages } from "../media/canvas-images.js";
import { registerImageField } from "../media/ImageField.js";
import { registerMediaPanel } from "../media/register-media-panel.js";
import { type CanvasView, connectCanvasView } from "../shell/canvas-view.js";
import { useCommandRegistry } from "../shell/command-context.js";
import { COMMAND_IDS } from "../shell/command-ids.js";
import { installCommandShortcuts } from "../shell/commands.js";
import { usePanelRegistry } from "../shell/panel-context.js";
import { connectCanvasSettings } from "../site-settings/canvas-settings.js";
import { registerCanvasCommands } from "./canvas-commands.js";
import { EditPanelHost } from "./EditPanelHost.js";
import {
  connectEngine,
  currentPage,
  type EditorSession,
  type EngineConnection,
  runHistoryCommand,
} from "./editor-session.js";
import { type CompileCanvasCss, connectSiteCss } from "./site-css.js";
import { UndoHistoryPanel } from "./UndoHistoryPanel.js";
import { installUndoToasts } from "./undo-toasts.js";

/** Props of {@link Editor}. */
export type EditorProps = {
  readonly session: EditorSession;
  /** Creates the canvas engine; injectable for tests. */
  readonly createEngine?: () => CanvasEngine;
  /** Compiles the site CSS for the canvas; injectable for tests. Defaults to the preload API. */
  readonly compileCss?: CompileCanvasCss;
  /** Design or Content mode (M3, 1.10): passed to the engine, which locks the layout in Content. */
  readonly mode?: EditorMode;
  /** The canvas toolbar's zoom and size readout (1.15), kept in step with the engine. */
  readonly canvasView?: CanvasView;
  /** Simple or Advanced mode (F-ED-11): Advanced adds the Edit panel's Advanced tab. */
  readonly editorLevel?: Preferences["editorLevel"];
};

const compileWithPreload: CompileCanvasCss = (request) =>
  window.webforge.canvas.compileCss(request);

/**
 * The site editor around one {@link EditorSession}: the canvas, plus the Undo and Redo commands
 * and the Undo History panel it contributes to the window shell.
 */
export function Editor({
  session,
  createEngine = createPuckEngine,
  compileCss = compileWithPreload,
  mode = "design",
  canvasView,
  editorLevel = "simple",
}: EditorProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [engine, setEngine] = useState<CanvasEngine | null>(null);
  // The mode at mount time, so a site opened in Content mode is never unlocked for a moment.
  const modeRef = useRef(mode);
  useEffect(() => {
    modeRef.current = mode;
  });
  const connectionRef = useRef<EngineConnection | null>(null);
  const addPanelRef = useRef<AddPanelRegistration | null>(null);
  const { history } = session;
  const registry = useCommandRegistry();
  const state = useSyncExternalStore(
    history.state.subscribe,
    history.state.getState,
    history.state.getState,
  );

  // Undo and Redo live in the title bar, the Edit menu and the command box (1.2); registered
  // before the canvas's own commands so they head the Edit menu.
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
    if (modeRef.current !== "design") {
      engine.setMode(modeRef.current);
    }
    const page = currentPage(session);
    if (page !== undefined) {
      engine.loadPage(page.doc, site.layout);
    }
    const connection = connectEngine(engine, session);
    connectionRef.current = connection;
    setEngine(engine);
    const stopSiteCss = connectSiteCss(engine, session, compileCss, document.baseURI);
    const stopImages = connectCanvasImages(engine, session);
    const stopSettings = connectCanvasSettings(engine, session);
    // One handler for the whole window (U4); the engine reports keys pressed inside its iframe.
    const removeKeys = installHistoryKeys(window, (command) => {
      connection.flush();
      return runHistoryCommand(session, command);
    });
    // Keyboard actions on the selected element (1.12), in the Edit menu and the command box; their
    // shortcuts also work while the canvas iframe has focus.
    // Cut, Copy and Paste of sections and elements (1.25) come first, as in other apps' menus.
    const clipboardCommands = registerClipboardCommands(
      registry,
      session,
      preloadClipboard,
      connection.flush,
      (message) => toast(message),
    );
    const canvasCommands = registerCanvasCommands(registry, engine, connection.flush);
    canvasCommands.setHasSelection(session.ui.getState().nodeId !== null);
    const stopSelectionWatch = session.ui.subscribe((ui) => {
      canvasCommands.setHasSelection(ui.nodeId !== null);
      clipboardCommands.setHasSelection(ui.nodeId !== null);
    });
    let removeFrameShortcuts: (() => void) | undefined;
    const stopFrameWindow = engine.onFrameWindow((frameWindow) => {
      removeFrameShortcuts?.();
      removeFrameShortcuts =
        frameWindow === null ? undefined : installCommandShortcuts(frameWindow, registry);
    });
    // The floating + opens the Add panel's Sections, ready to add one at its place (UI1).
    const stopAdd = engine.onAddRequest((at) => addPanelRef.current?.openAt(at));

    return () => {
      setEngine(null);
      stopAdd();
      stopFrameWindow();
      removeFrameShortcuts?.();
      stopSelectionWatch();
      canvasCommands.remove();
      clipboardCommands.remove();
      stopSiteCss();
      stopImages();
      stopSettings();
      removeKeys();
      connectionRef.current = null;
      connection.disconnect();
      engine.destroy();
      element.remove();
    };
  }, [session, history, createEngine, compileCss, registry]);

  useEffect(() => {
    engine?.setMode(mode);
  }, [engine, mode]);

  useEffect(
    () =>
      engine === null || canvasView === undefined
        ? undefined
        : connectCanvasView(engine, canvasView),
    [engine, canvasView],
  );

  // "Deleted Heading · Undo" after each delete (D4, 1.11).
  useEffect(
    () =>
      installUndoToasts(
        session,
        { show: (message, options) => toast(message, options), dismiss: (id) => toast.dismiss(id) },
        () => connectionRef.current?.flush(),
      ),
    [session],
  );

  // Undo History goes in the left column's bottom (UI1).
  const panels = usePanelRegistry();
  useEffect(() => {
    const jumpTo = (entryId: string | null) => {
      connectionRef.current?.flush();
      return history.jumpTo(entryId);
    };
    function UndoHistory() {
      const historyState = useSyncExternalStore(
        history.state.subscribe,
        history.state.getState,
        history.state.getState,
      );
      return <UndoHistoryPanel history={{ jumpTo }} state={historyState} />;
    }
    return panels.register({
      id: "undoHistory",
      slot: "left.bottom",
      title: t("editor.undoHistory"),
      component: UndoHistory,
    });
  }, [panels, history]);

  // The Edit panel replaces Puck's own fields (1.14). Registered on its own, so that changing the
  // editor level redraws it without registering Undo History again.
  useEffect(() => {
    function Edit() {
      return (
        <EditPanelHost
          session={session}
          flush={() => connectionRef.current?.flush()}
          advanced={editorLevel === "advanced"}
        />
      );
    }
    return panels.register({
      id: "edit",
      slot: "right.top",
      title: t("editPanel.title"),
      component: Edit,
    });
  }, [panels, session, editorLevel]);

  // The Add panel (1.13), hidden in Content mode (M3).
  useEffect(() => {
    if (mode !== "design") {
      return;
    }
    const addPanel = registerAddPanel(panels, session, () => connectionRef.current?.flush());
    addPanelRef.current = addPanel;
    return () => {
      addPanelRef.current = null;
      addPanel.remove();
    };
  }, [panels, session, mode]);
  useEffect(() => registerMediaPanel(panels, session), [panels, session]);
  useEffect(() => registerImageField({ session }), [session]);
  useEffect(() => registerLinkField({ session }), [session]);

  return <section className="editor__canvas" aria-label={t("editor.canvas")} ref={canvasRef} />;
}
