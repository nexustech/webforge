import { toast } from "@webforge/editor-ui";
import {
  type CanvasEngine,
  createPuckEngine,
  type EditorMode,
  type HistoryCommand,
  installHistoryKeys,
  type ViewOptions,
} from "@webforge/engine";
import { t } from "@webforge/i18n";
import { textStylesOf } from "@webforge/site-components";
import { HistoryIcon, SlidersHorizontalIcon } from "lucide-react";
import { type RefObject, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createStore, type StoreApi } from "zustand/vanilla";
import {
  type AddPreferences,
  type CustomDevice,
  DEFAULT_PREFERENCES,
  type EditPanelPreferences,
} from "../../shared/ipc/prefs.js";
import type { Preferences } from "../../shared/ipc-contract.js";
import { type AddPanelRegistration, registerAddPanel } from "../add/register-add-panel.js";
import { createSectionPreviews } from "../add/section-preview.js";
import {
  preloadClipboard,
  registerClipboardCommands,
} from "../clipboard/register-clipboard-commands.js";
import { registerStyleCommands } from "../clipboard/style-clipboard.js";
import { CanvasElementMenu } from "../element-menu/CanvasElementMenu.js";
import { deleteSelected, duplicateSelected, moveSelected } from "../layers/bulk-layers.js";
import type { Layer } from "../layers/layers.js";
import { registerLinkField } from "../links/LinkField.js";
import { RichTextLinkHost } from "../links/RichTextLinkHost.js";
import { connectCanvasImages } from "../media/canvas-images.js";
import { registerImageField } from "../media/ImageField.js";
import { createImagePickRequests } from "../media/image-picks.js";
import { registerMediaPanel } from "../media/register-media-panel.js";
import { connectCanvasNavigation } from "../menu/canvas-navigation.js";
import {
  registerSharedSectionCommands,
  removeSharedSection,
  SharedSectionNameDialog,
  type SharedSectionNaming,
} from "../shared-sections/SharedSectionCommands.js";
import { sharedSection } from "../shared-sections/shared-sections.js";
import { widthOf } from "../shell/canvas-size.js";
import { type CanvasView, connectCanvasView } from "../shell/canvas-view.js";
import { useCommandRegistry } from "../shell/command-context.js";
import { COMMAND_IDS } from "../shell/command-ids.js";
import { installCommandShortcuts } from "../shell/commands.js";
import type { SiteWideConfirm } from "../shell/confirm-site-wide.js";
import { usePanelRegistry } from "../shell/panel-context.js";
import { connectCanvasSettings } from "../site-settings/canvas-settings.js";
import { CanvasBreadcrumbs } from "./CanvasBreadcrumbs.js";
import { CanvasResizeHandles } from "./CanvasResizeHandles.js";
import { registerColourField } from "./ColourField.js";
import { type BulkCanvasAction, registerCanvasCommands } from "./canvas-commands.js";
import { EditPanelHost, type EditPanelHostProps } from "./EditPanelHost.js";
import {
  connectEngine,
  currentPage,
  type EditorSession,
  type EngineConnection,
  runHistoryCommand,
} from "./editor-session.js";
import { registerElementCommands } from "./element-commands.js";
import { connectFieldDrags } from "./field-drag.js";
import { fieldTarget } from "./field-target.js";
import { SharedRegionBanner } from "./SharedRegionBanner.js";
import { confirmSharedRemovals, sharedCutConfirmation } from "./shared-confirmations.js";
import { shownLayout } from "./shared-layout.js";
import { type CompileCanvasCss, connectSiteCss } from "./site-css.js";
import { UndoHistoryPanel, type UndoHistoryPanelProps } from "./UndoHistoryPanel.js";
import { installUndoToasts, undoEntry } from "./undo-toasts.js";

/** How the title bar's list of steps undoes back to one (UX-16): false if the step is gone. */
export type UndoTo = { readonly run: (entryId: string) => boolean };

/** `preferences` with `closed` as the option groups closed for component `type` (UX-13). */
function withClosedGroups(
  preferences: EditPanelPreferences,
  type: string,
  closed: readonly string[],
): EditPanelPreferences {
  const others = Object.entries(preferences.closedGroups).filter(([each]) => each !== type);
  return {
    closedGroups: Object.fromEntries(
      closed.length === 0 ? others : [...others, [type, [...closed]]],
    ),
  };
}

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
  /** The person's own devices, which dragging the canvas's edges snaps to (F-ED-25). */
  readonly devices?: readonly CustomDevice[];
  /** What the canvas shows besides the page: the View menu's options (F-ED-25). */
  readonly viewOptions?: ViewOptions;
  /** The Add panel's favourites and recently used items (F-ED-26), from the person's preferences. */
  readonly addPreferences?: AddPreferences;
  /** Saves them when the person changes their favourites or adds something. */
  readonly onAddPreferencesChange?: (next: AddPreferences) => void;
  /** The Edit panel's closed option groups, remembered per person (UX-13). */
  readonly editPanelPreferences?: EditPanelPreferences;
  /** Saves the Edit panel's closed option groups. */
  readonly onEditPanelPreferencesChange?: (next: EditPanelPreferences) => void;
  /**
   * Hands over how to undo back to a step (UX-16, the title bar's list of steps), and `null` once
   * this editor is gone. Called again only when the session changes, so a state setter will do.
   */
  readonly onUndoTo?: (undoTo: UndoTo | null) => void;
};

const compileWithPreload: CompileCanvasCss = (request) =>
  window.webforge.canvas.compileCss(request);

/** The Undo History panel for `history`, jumping to a step with `jumpTo`. */
function undoHistoryPanel(
  history: EditorSession["history"],
  jumpTo: UndoHistoryPanelProps["history"]["jumpTo"],
) {
  return function UndoHistory() {
    const state = useSyncExternalStore(
      history.state.subscribe,
      history.state.getState,
      history.state.getState,
    );
    return <UndoHistoryPanel history={{ jumpTo }} state={state} />;
  };
}

/**
 * The Edit panel as a panel component (1.14): the selected element's fields, with the option
 * groups the person closed from `store`, which keeps them in the preferences (UX-13).
 */
function editPanel({
  session,
  flush,
  advanced,
  contentOnly,
  store,
}: Pick<EditPanelHostProps, "session" | "flush" | "advanced" | "contentOnly"> & {
  readonly store: StoreApi<EditPanelPreferences>;
}) {
  return function Edit() {
    const { closedGroups } = useSyncExternalStore(store.subscribe, store.getState);
    return (
      <EditPanelHost
        session={session}
        flush={flush}
        {...(advanced === undefined ? {} : { advanced })}
        {...(contentOnly === undefined ? {} : { contentOnly })}
        closedGroups={closedGroups}
        onClosedGroupsChange={(type, closed) =>
          store.setState(withClosedGroups(store.getState(), type, closed))
        }
      />
    );
  };
}

/**
 * The canvas frame's edge handles on `session`'s device view and `view`'s zoom: a width dragged or
 * typed with the arrows becomes the view's width, as the toolbar's width field does (U6).
 */
function CanvasEdges({
  session,
  view,
  container,
  devices,
}: {
  readonly session: EditorSession;
  readonly view: CanvasView;
  readonly container: RefObject<HTMLElement | null>;
  readonly devices: readonly CustomDevice[];
}) {
  const viewport = useSyncExternalStore(session.ui.subscribe, () => session.ui.getState().viewport);
  const zoom = useSyncExternalStore(view.subscribe, () => view.getState().size?.zoom ?? 1);
  return (
    <CanvasResizeHandles
      container={container}
      width={widthOf(viewport)}
      zoom={zoom}
      devices={devices}
      onChange={(next) => session.ui.setState({ viewport: next })}
    />
  );
}

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
  devices = [],
  viewOptions,
  addPreferences = DEFAULT_PREFERENCES.add,
  onAddPreferencesChange,
  editPanelPreferences = DEFAULT_PREFERENCES.editPanel,
  onEditPanelPreferencesChange,
  onUndoTo,
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
  const styleCommandsRef = useRef<ReturnType<typeof registerStyleCommands> | null>(null);
  const sharedCommandsRef = useRef<ReturnType<typeof registerSharedSectionCommands> | null>(null);
  const canvasCommandsRef = useRef<ReturnType<typeof registerCanvasCommands> | null>(null);
  const elementCommandsRef = useRef<ReturnType<typeof registerElementCommands> | null>(null);
  const panels = usePanelRegistry();
  // *Edit* on an image (F-ED-25) opens the Edit panel's image picker: the panel shows, and the
  // field opens it once it is drawn.
  const [imagePicks] = useState(createImagePickRequests);
  // The layer whose name the rename dialog asks for (F2, or the element menu's Rename).
  const [renaming, setRenaming] = useState<Layer | null>(null);
  const pickImageRef = useRef((nodeId: string) => {
    panels.show("edit");
    imagePicks.request(nodeId);
  });
  const addPanelRef = useRef<AddPanelRegistration | null>(null);
  const { history } = session;
  const registry = useCommandRegistry();
  // The shared-section name the dialog asks for (saving or renaming one), while it is open.
  const [naming, setNaming] = useState<SharedSectionNaming | null>(null);
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
      enabled: history.state.getState().canUndo,
      run: () => runCommand("undo"),
    });
    const removeRedo = registry.register({
      id: COMMAND_IDS.redo,
      label: t("editor.redo"),
      menu: "edit",
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
    const stopSiteCss = connectSiteCss(engine, session, compileCss);
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
    // Copy Style and Paste Style (1.37), after them.
    const styleCommands = registerStyleCommands(registry, session, connection.flush);
    styleCommands.setLayoutLocked(modeRef.current !== "design");
    styleCommandsRef.current = styleCommands;
    // While several elements are selected, the canvas's edits act on all of them (1.31).
    const bulk = (action: BulkCanvasAction) => {
      const { refused } =
        action === "delete"
          ? deleteSelected(session)
          : action === "duplicate"
            ? duplicateSelected(session)
            : moveSelected(session, action === "moveUp" ? "up" : "down");
      if (refused !== undefined) toast(refused);
    };
    const canvasCommands = registerCanvasCommands(registry, engine, connection.flush, bulk);
    canvasCommands.setHasSelection(session.ui.getState().nodeId !== null);
    // The shared-section commands (1.29), after the canvas's own actions.
    const sharedCommands = registerSharedSectionCommands(
      registry,
      session,
      connection.flush,
      setNaming,
      siteWide,
    );
    sharedCommands.setLayoutLocked(modeRef.current !== "design");
    sharedCommandsRef.current = sharedCommands;
    canvasCommands.setLayoutLocked(modeRef.current !== "design");
    canvasCommandsRef.current = canvasCommands;
    // Hide or show (Mod + /), and the chip's Hide and Edit on an image (1.30).
    const elementCommands = registerElementCommands(
      registry,
      session,
      engine,
      connection.flush,
      (nodeId) => pickImageRef.current(nodeId),
      setRenaming,
      (message) => toast(message),
    );
    elementCommands.setLayoutLocked(modeRef.current !== "design");
    elementCommandsRef.current = elementCommands;
    const stopSelectionWatch = session.ui.subscribe((ui) => {
      // Several selected elements (1.31): the edits that act on one are off until they act on all.
      const several = (ui.others ?? []).length > 0;
      canvasCommands.setHasSelection(ui.nodeId !== null);
      canvasCommands.setSeveral(several);
      clipboardCommands.setHasSelection(ui.nodeId !== null && !several);
    });
    let removeFrameShortcuts: (() => void) | undefined;
    const stopFrameWindow = engine.onFrameWindow((frameWindow) => {
      removeFrameShortcuts?.();
      removeFrameShortcuts =
        frameWindow === null ? undefined : installCommandShortcuts(frameWindow, registry);
    });
    // The floating + opens the Add panel's Sections, ready to add one at its place (UI1).
    const stopAdd = engine.onAddRequest((at) => addPanelRef.current?.openAt(at));
    // Drags of the spacing handles (1.32), one step each, as the Edit panel makes them.
    const stopFieldDrags = connectFieldDrags(engine, session, connection.flush);

    return () => {
      setEngine(null);
      stopFieldDrags();
      stopAdd();
      stopFrameWindow();
      removeFrameShortcuts?.();
      stopSelectionWatch();
      canvasCommandsRef.current = null;
      canvasCommands.remove();
      elementCommandsRef.current = null;
      elementCommands.remove();
      sharedCommandsRef.current = null;
      sharedCommands.remove();
      clipboardCommandsRef.current = null;
      clipboardCommands.remove();
      styleCommandsRef.current = null;
      styleCommands.remove();
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

  // The View menu's options (F-ED-25): view state, never an undo step (U6).
  useEffect(() => {
    if (viewOptions !== undefined) engine?.setViewOptions(viewOptions);
  }, [engine, viewOptions]);

  useEffect(() => {
    engine?.setMode(mode);
    clipboardCommandsRef.current?.setLayoutLocked(mode !== "design");
    styleCommandsRef.current?.setLayoutLocked(mode !== "design");
    sharedCommandsRef.current?.setLayoutLocked(mode !== "design");
    canvasCommandsRef.current?.setLayoutLocked(mode !== "design");
    elementCommandsRef.current?.setLayoutLocked(mode !== "design");
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

  // Undoing back to a step from the title bar (UX-16): one jump, as Undo History and the Undo
  // toasts make, after the canvas's pending edit; a gesture in progress is dropped first, as
  // Ctrl/Cmd+Z drops it, so the jump lands where it was asked to.
  useEffect(() => {
    onUndoTo?.({
      run: (entryId) => {
        connectionRef.current?.flush();
        session.cancelGesture();
        return undoEntry(history, entryId);
      },
    });
    return () => onUndoTo?.(null);
  }, [onUndoTo, session, history]);

  // Undo History goes in the left column's bottom (UI1).
  useEffect(
    () =>
      panels.register({
        id: "undoHistory",
        slot: "left.bottom",
        title: t("editor.undoHistory"),
        icon: HistoryIcon,
        component: undoHistoryPanel(history, (entryId) => {
          connectionRef.current?.flush();
          return history.jumpTo(entryId);
        }),
      }),
    [panels, history],
  );

  // The Edit panel's closed option groups (UX-13): one store the panel follows, in step with the
  // preferences both ways, so a change never re-registers the panel (its tab stays).
  const [editPanelStore] = useState(() =>
    createStore<EditPanelPreferences>()(() => editPanelPreferences),
  );
  const givenEditPanelPreferences = useRef(editPanelPreferences);
  useEffect(() => {
    givenEditPanelPreferences.current = editPanelPreferences;
    if (editPanelStore.getState() !== editPanelPreferences) {
      editPanelStore.setState(editPanelPreferences, true);
    }
  }, [editPanelStore, editPanelPreferences]);
  const saveEditPanelPreferences = useRef(onEditPanelPreferencesChange);
  useEffect(() => {
    saveEditPanelPreferences.current = onEditPanelPreferencesChange;
  });
  useEffect(
    () =>
      // Saves the panel's changes, not the preferences it was given back again.
      editPanelStore.subscribe((next) => {
        if (next !== givenEditPanelPreferences.current) saveEditPanelPreferences.current?.(next);
      }),
    [editPanelStore],
  );

  // The Edit panel replaces Puck's own fields (1.14). Registered on its own, so that changing the
  // editor level or mode (Content shows its Content tab only) redraws it alone.
  useEffect(
    () =>
      panels.register({
        id: "edit",
        slot: "right.top",
        title: t("editPanel.title"),
        icon: SlidersHorizontalIcon,
        component: editPanel({
          session,
          flush: () => connectionRef.current?.flush(),
          advanced: editorLevel === "advanced",
          contentOnly: mode !== "design",
          store: editPanelStore,
        }),
      }),
    [panels, session, editorLevel, mode, editPanelStore],
  );

  // The Add panel's favourites and recents (1.34): one store the panel follows, in step with the
  // preferences both ways, so a change never re-registers the panel (its tab and + place stay).
  const [addStore] = useState(() => createStore<AddPreferences>()(() => addPreferences));
  const givenAddPreferences = useRef(addPreferences);
  useEffect(() => {
    givenAddPreferences.current = addPreferences;
    if (addStore.getState() !== addPreferences) addStore.setState(addPreferences, true);
  }, [addStore, addPreferences]);
  const saveAddPreferences = useRef(onAddPreferencesChange);
  useEffect(() => {
    saveAddPreferences.current = onAddPreferencesChange;
  });
  useEffect(
    () =>
      // Saves the panel's changes, not the preferences it was given back again.
      addStore.subscribe((next) => {
        if (next !== givenAddPreferences.current) saveAddPreferences.current?.(next);
      }),
    [addStore],
  );
  // The sections' larger previews in the Add panel (UX-10), drawn with the site's theme. Made once
  // for the editor's session, so the drawings they keep outlive switches of mode.
  const [previews] = useState(() =>
    createSectionPreviews({
      library: session.library,
      theme: () => session.history.document.getState().theme,
      sharedSection: (id) => sharedSection(session.history.document.getState(), id)?.section,
      compileCss,
    }),
  );

  // The Add panel (1.13), hidden in Content mode (M3), and the palette's Add commands with it.
  useEffect(() => {
    if (mode !== "design") {
      return;
    }
    // Its items drag new elements onto the canvas once there is one.
    const addPanel = registerAddPanel(panels, session, {
      flush: () => connectionRef.current?.flush(),
      dragSource:
        engine === null ? undefined : (element, type) => engine.addDragSource(element, type),
      // Rename and Delete for shared sections, those on no page included (1.29).
      sharedActions: {
        rename: (id) => {
          const shared = sharedSection(session.history.document.getState(), id);
          if (shared !== undefined) setNaming({ kind: "rename", id, suggested: shared.name });
        },
        remove: (id) => removeSharedSection(session, id, siteWide),
      },
      preferences: addStore,
      commands: registry,
      preview: previews,
    });
    addPanelRef.current = addPanel;
    return () => {
      addPanelRef.current = null;
      addPanel.remove();
    };
  }, [panels, session, mode, engine, siteWide, addStore, registry, previews]);
  useEffect(() => registerMediaPanel(panels, session), [panels, session]);
  useEffect(() => registerImageField({ session, picks: imagePicks }), [session, imagePicks]);
  // Colour fields show the theme's own colours and warn about low contrast (1.37, UX-25).
  useEffect(
    () =>
      registerColourField({
        session,
        advanced: editorLevel === "advanced",
        // The selected element's text styles, wherever it is (the page, the shared Header or
        // Footer, a linked copy), as the Edit panel finds it.
        textStyles: () => {
          const { pageId, nodeId } = session.ui.getState();
          const target = fieldTarget(
            session.history.document.getState(),
            session.library,
            pageId,
            nodeId,
          );
          return target === undefined ? [] : textStylesOf(target.node, session.library);
        },
      }),
    [session, editorLevel],
  );
  useEffect(() => registerLinkField({ session }), [session]);

  return (
    <div className="editor">
      <CanvasBreadcrumbs session={session} engine={engine} />
      <SharedRegionBanner session={session} />
      <RichTextLinkHost session={session} engine={engine} />
      <SharedSectionNameDialog session={session} naming={naming} onClose={() => setNaming(null)} />
      <CanvasElementMenu
        engine={engine}
        session={session}
        renaming={renaming}
        onRenamingChange={setRenaming}
      />
      <div className="editor__stage">
        <section className="editor__canvas" aria-label={t("editor.canvas")} ref={canvasRef} />
        {canvasView !== undefined && (
          <CanvasEdges
            session={session}
            view={canvasView}
            container={canvasRef}
            devices={devices}
          />
        )}
      </div>
    </div>
  );
}
