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
import { RichTextLinkHost } from "../links/RichTextLinkHost.js";
import { connectCanvasImages } from "../media/canvas-images.js";
import { registerImageField } from "../media/ImageField.js";
import { registerMediaPanel } from "../media/register-media-panel.js";
import { connectCanvasNavigation } from "../menu/canvas-navigation.js";
import {
  registerSharedSectionCommands,
  SaveSharedSectionDialog,
} from "../shared-sections/SharedSectionCommands.js";
import { type CanvasView, connectCanvasView } from "../shell/canvas-view.js";
import { useCommandRegistry } from "../shell/command-context.js";
import { COMMAND_IDS } from "../shell/command-ids.js";
import { installCommandShortcuts } from "../shell/commands.js";
import type { SiteWideConfirm } from "../shell/confirm-site-wide.js";
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
import { SharedRegionBanner } from "./SharedRegionBanner.js";
import { confirmSharedRemovals, sharedCutConfirmation } from "./shared-confirmations.js";
import { shownLayout } from "./shared-layout.js";
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
  /**
   * Asks before what changes more than the page shown (D7): deleting or cutting an element of the
   * shared Header or Footer. Undo and Redo wait while it asks. Without it, they happen at once.
   */
  readonly siteWide?: Pick<SiteWideConfirm, "confirmSiteWide" | "current">;
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
  siteWide,
}: EditorProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [engine, setEngine] = useState<CanvasEngine | null>(null);
  // The mode at mount time, so a site opened in Content mode is never unlocked for a moment.
  const modeRef = useRef(mode);
  useEffect(() => {
    modeRef.current = mode;
  });
  const connectionRef = useRef<EngineConnection | null>(null);
  const clipboardCommandsRef = useRef<ReturnType<typeof registerClipboardCommands> | null>(null);
  const sharedCommandsRef = useRef<ReturnType<typeof registerSharedSectionCommands> | null>(null);
  const canvasCommandsRef = useRef<ReturnType<typeof registerCanvasCommands> | null>(null);
  const addPanelRef = useRef<AddPanelRegistration | null>(null);
  const { history } = session;
  const registry = useCommandRegistry();
  // The name the selected section is being saved as a shared section under, while the dialog asks.
  const [sharedName, setSharedName] = useState<string | null>(null);
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
      engine.loadPage(page.doc, shownLayout(site, page.id), site.sharedSections);
    }
    const connection = connectEngine(
      siteWide === undefined ? engine : confirmSharedRemovals(engine, session, siteWide),
      session,
    );
    connectionRef.current = connection;
    setEngine(engine);
    const stopSiteCss = connectSiteCss(engine, session, compileCss, document.baseURI);
    const stopImages = connectCanvasImages(engine, session);
    const stopSettings = connectCanvasSettings(engine, session);
    const stopNavigation = connectCanvasNavigation(engine, session);
    // One handler for the whole window (U4); the engine reports keys pressed inside its iframe.
    const removeKeys = installHistoryKeys(window, (command) => {
      // Nothing changes while a question about the whole site waits for its answer (D7); Esc
      // goes to its dialog.
      if (siteWide !== undefined && siteWide.current() !== null) return false;
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
      siteWide === undefined ? undefined : sharedCutConfirmation(session, siteWide),
    );
    clipboardCommands.setLayoutLocked(modeRef.current !== "design");
    clipboardCommandsRef.current = clipboardCommands;
    const canvasCommands = registerCanvasCommands(registry, engine, connection.flush);
    canvasCommands.setHasSelection(session.ui.getState().nodeId !== null);
    // Save as shared section and Detach (1.29), after the canvas's own actions.
    const sharedCommands = registerSharedSectionCommands(
      registry,
      session,
      connection.flush,
      setSharedName,
    );
    sharedCommands.setLayoutLocked(modeRef.current !== "design");
    sharedCommandsRef.current = sharedCommands;
    canvasCommands.setLayoutLocked(modeRef.current !== "design");
    canvasCommandsRef.current = canvasCommands;
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
      canvasCommandsRef.current = null;
      canvasCommands.remove();
      sharedCommandsRef.current = null;
      sharedCommands.remove();
      clipboardCommandsRef.current = null;
      clipboardCommands.remove();
      stopSiteCss();
      stopImages();
      stopSettings();
      stopNavigation();
      removeKeys();
      connectionRef.current = null;
      connection.disconnect();
      engine.destroy();
      element.remove();
    };
  }, [session, history, createEngine, compileCss, registry, siteWide]);

  useEffect(() => {
    engine?.setMode(mode);
    clipboardCommandsRef.current?.setLayoutLocked(mode !== "design");
    sharedCommandsRef.current?.setLayoutLocked(mode !== "design");
    canvasCommandsRef.current?.setLayoutLocked(mode !== "design");
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
  // editor level or mode (Content shows its Content tab only) redraws it alone.
  useEffect(() => {
    function Edit() {
      return (
        <EditPanelHost
          session={session}
          flush={() => connectionRef.current?.flush()}
          advanced={editorLevel === "advanced"}
          contentOnly={mode !== "design"}
        />
      );
    }
    return panels.register({
      id: "edit",
      slot: "right.top",
      title: t("editPanel.title"),
      component: Edit,
    });
  }, [panels, session, editorLevel, mode]);

  // The Add panel (1.13), hidden in Content mode (M3).
  useEffect(() => {
    if (mode !== "design") {
      return;
    }
    // Its items drag new elements onto the canvas once there is one.
    const addPanel = registerAddPanel(panels, session, {
      flush: () => connectionRef.current?.flush(),
      dragSource:
        engine === null ? undefined : (element, type) => engine.addDragSource(element, type),
    });
    addPanelRef.current = addPanel;
    return () => {
      addPanelRef.current = null;
      addPanel.remove();
    };
  }, [panels, session, mode, engine]);
  useEffect(() => registerMediaPanel(panels, session), [panels, session]);
  useEffect(() => registerImageField({ session }), [session]);
  useEffect(() => registerLinkField({ session }), [session]);

  return (
    <div className="editor">
      <SharedRegionBanner session={session} />
      <RichTextLinkHost session={session} engine={engine} />
      <SaveSharedSectionDialog
        session={session}
        suggested={sharedName}
        onClose={() => setSharedName(null)}
      />
      <section className="editor__canvas" aria-label={t("editor.canvas")} ref={canvasRef} />
    </div>
  );
}
