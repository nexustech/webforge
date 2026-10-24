import { type FieldRenderers, FieldRenderersProvider, toast } from "@webforge/editor-ui";
import {
  type CanvasEngine,
  createPuckEngine,
  type HistoryCommand,
  installHistoryKeys,
  type ViewOptions,
} from "@webforge/engine";
import { t } from "@webforge/i18n";
import { textStylesOf } from "@webforge/site-components";
import { HistoryIcon, SlidersHorizontalIcon } from "lucide-react";
import { type RefObject, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { shallow } from "zustand/shallow";
import type { CustomDevice, EditPanelPreferences } from "../../shared/ipc/prefs.js";
import { type AddPanelRegistration, registerAddPanel } from "../add/register-add-panel.js";
import { createSectionPreviews } from "../add/section-preview.js";
import {
  preloadClipboard,
  registerClipboardCommands,
} from "../clipboard/register-clipboard-commands.js";
import { registerStyleCommands } from "../clipboard/style-clipboard.js";
import { CanvasElementMenu } from "../element-menu/CanvasElementMenu.js";
import { createErrorReporter, type ReportError } from "../error-reporting.js";
import { deleteSelected, duplicateSelected, moveSelected } from "../layers/bulk-layers.js";
import { linkFieldRenderer } from "../links/LinkField.js";
import { RichTextLinkHost } from "../links/RichTextLinkHost.js";
import { connectCanvasImages } from "../media/canvas-images.js";
import { imageFieldRenderer } from "../media/ImageField.js";
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
import { useContextualToolbars } from "../shell/contextual-toolbar-context.js";
import { CanvasErrorBoundary } from "../shell/error-boundaries.js";
import { usePanelRegistry } from "../shell/panel-context.js";
import {
  createPreferencesStore,
  type EditorPreferences,
  type PreferencesStore,
  usePreferences,
} from "../shell/preferences-store.js";
import { connectCanvasSettings } from "../site-settings/canvas-settings.js";
import { CanvasBreadcrumbs } from "./CanvasBreadcrumbs.js";
import { CanvasResizeHandles } from "./CanvasResizeHandles.js";
import { colourFieldRenderer } from "./ColourField.js";
import { columnsToolbar } from "./ColumnsToolbar.js";
import { type BulkCanvasAction, registerCanvasCommands } from "./canvas-commands.js";
import { EditPanelHost, type EditPanelHostProps } from "./EditPanelHost.js";
import { canvasPreviews, createPreviewStore } from "./edit-previews.js";
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
import { headerToolbar } from "./HeaderToolbar.js";
import { headingToolbar } from "./HeadingToolbar.js";
import { IconField } from "./IconField.js";
import { listToolbar } from "./ListToolbar.js";
import type { Layer } from "./layers.js";
import { SharedRegionBanner } from "./SharedRegionBanner.js";
import { confirmSharedRemovals, sharedCutConfirmation } from "./shared-confirmations.js";
import { shownLayout } from "./shared-layout.js";
import { type CompileCanvasCss, connectSiteCss } from "./site-css.js";
import { UndoHistoryPanel, type UndoHistoryPanelProps } from "./UndoHistoryPanel.js";
import { installUndoToasts } from "./undo-toasts.js";
import { useUi } from "./use-document.js";

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
  /** Reports an error in the canvas as a local crash report (R3); injectable for tests. */
  readonly reportError?: ReportError;
  /**
   * The person's preferences and the editor mode (R9): Design or Content (M3, 1.10), which the
   * engine locks the layout in; Simple or Advanced (F-ED-11), which adds the Edit panel's Advanced
   * tab; the View menu's options and the person's own devices (F-ED-25); the Add panel's
   * favourites and recently used items (F-ED-26). The defaults, in Design mode, unless given.
   */
  readonly preferences?: PreferencesStore;
  /** The canvas toolbar's zoom and size readout (1.15), kept in step with the engine. */
  readonly canvasView?: CanvasView;
  /**
   * Asks before what changes more than the page shown (D7): deleting or cutting an element of the
   * shared Header or Footer. Undo and Redo wait while it asks. Without it, they happen at once.
   */
  readonly siteWide?: Pick<SiteWideConfirm, "confirmSiteWide" | "current">;
};

/** The View menu's options as the canvas takes them (F-ED-25). */
const viewOptionsOf = ({ preferences: { canvas } }: EditorPreferences): ViewOptions => ({
  outlines: canvas.showOutlines,
  spacingOnHover: canvas.spacingOnHover,
  elementNames: canvas.elementNames,
  extraBottomSpace: canvas.extraBottomSpace,
});

const compileWithPreload: CompileCanvasCss = (request) =>
  window.webforge.canvas.compileCss(request);
const reportWithPreload = createErrorReporter((kind, error) =>
  window.webforge.app.reportError(kind, error),
);

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
 * The Edit panel as the preferences have it: with the Advanced tab in Advanced mode, the Content
 * tab only in Content mode (R9), and the option groups the person closed (UX-13).
 */
function PreferredEditPanel({
  preferences,
  ...props
}: Omit<
  EditPanelHostProps,
  "advanced" | "contentOnly" | "closedGroups" | "onClosedGroupsChange"
> & {
  readonly preferences: PreferencesStore;
}) {
  const advanced = usePreferences(
    preferences,
    (state) => state.preferences.editorLevel === "advanced",
  );
  const contentOnly = usePreferences(preferences, (state) => state.mode !== "design");
  const closedGroups = usePreferences(
    preferences,
    (state) => state.preferences.editPanel.closedGroups,
  );
  return (
    <EditPanelHost
      {...props}
      advanced={advanced}
      contentOnly={contentOnly}
      closedGroups={closedGroups}
      onClosedGroupsChange={(type, closed) =>
        preferences.change({
          editPanel: withClosedGroups(preferences.getState().preferences.editPanel, type, closed),
        })
      }
    />
  );
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
  const viewport = useUi(session, (ui) => ui.viewport);
  const zoom = useSyncExternalStore(view.subscribe, () => view.getState().size?.zoom ?? 1);
  return (
    <CanvasResizeHandles
      container={container}
      width={widthOf(viewport)}
      zoom={zoom}
      devices={devices}
      onChange={(next) => session.setViewport(next)}
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
  reportError = reportWithPreload,
  preferences: givenPreferences,
  canvasView,
  siteWide,
}: EditorProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [engine, setEngine] = useState<CanvasEngine | null>(null);
  const [defaultPreferences] = useState(() => createPreferencesStore());
  const preferences = givenPreferences ?? defaultPreferences;
  const mode = usePreferences(preferences, (state) => state.mode);
  const devices = usePreferences(preferences, (state) => state.preferences.canvas.devices);
  const viewOptions = usePreferences(preferences, viewOptionsOf, shallow);
  /** The edit-only previews the user turned on (UX-26), for this window. */
  const [editPreviews] = useState(() => createPreviewStore());
  const connectionRef = useRef<EngineConnection | null>(null);
  const clipboardCommandsRef = useRef<ReturnType<typeof registerClipboardCommands> | null>(null);
  const styleCommandsRef = useRef<ReturnType<typeof registerStyleCommands> | null>(null);
  const sharedCommandsRef = useRef<ReturnType<typeof registerSharedSectionCommands> | null>(null);
  const canvasCommandsRef = useRef<ReturnType<typeof registerCanvasCommands> | null>(null);
  const elementCommandsRef = useRef<ReturnType<typeof registerElementCommands> | null>(null);
  const panels = usePanelRegistry();
  const toolbars = useContextualToolbars();
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
    // The mode as the canvas mounts: a site opened in Content mode is never unlocked for a moment.
    const mountMode = preferences.getState().mode;
    // A fresh element per mount, so React's StrictMode remount never reuses an unmounting root.
    const element = document.createElement("div");
    element.className = "editor__canvas-root";
    container.append(element);

    const engine = createEngine();
    const site = history.document.getState();
    // Before mounting, so the canvas is drawn with them once, not drawn again for them.
    engine.setPreviews(canvasPreviews(editPreviews.getState(), session.ui.getState().viewport));
    engine.mount(element, {
      library: session.library,
      theme: site.theme,
      // An error in the canvas stays there, and becomes a local crash report (R3).
      errorBoundary: CanvasErrorBoundary,
      onError: (error, caught) => reportError(caught ? "render-error" : "uncaught-error", error),
    });
    if (mountMode !== "design") {
      engine.setMode(mountMode);
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
    clipboardCommands.setLayoutLocked(mountMode !== "design");
    clipboardCommandsRef.current = clipboardCommands;
    // Copy Style and Paste Style (1.37), after them.
    const styleCommands = registerStyleCommands(registry, session, connection.flush);
    styleCommands.setLayoutLocked(mountMode !== "design");
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
    sharedCommands.setLayoutLocked(mountMode !== "design");
    sharedCommandsRef.current = sharedCommands;
    canvasCommands.setLayoutLocked(mountMode !== "design");
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
    elementCommands.setLayoutLocked(mountMode !== "design");
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
  }, [
    session,
    history,
    createEngine,
    compileCss,
    reportError,
    registry,
    siteWide,
    preferences,
    editPreviews,
  ]);

  // The View menu's options (F-ED-25): view state, never an undo step (U6).
  useEffect(() => {
    engine?.setViewOptions(viewOptions);
  }, [engine, viewOptions]);

  // The edit-only previews (UX-26), at the canvas's width: view state too, never in the export.
  // Followed outside React, so a view change doesn't draw the editor again; the engine draws the
  // page again only when what it previews changes.
  useEffect(() => {
    if (engine === null) return;
    const show = () =>
      engine.setPreviews(canvasPreviews(editPreviews.getState(), session.ui.getState().viewport));
    show();
    const stopChoices = editPreviews.subscribe(show);
    const stopViewport = session.ui.subscribe(show);
    return () => {
      stopChoices();
      stopViewport();
    };
  }, [engine, editPreviews, session]);

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

  // The Edit panel replaces Puck's own fields (1.14). Registered once: it follows the editor level
  // and the mode (Content shows its Content tab only) itself, so a switch redraws it alone (R9).
  useEffect(() => {
    // The fields the app draws itself (R11): images, links, icons, and colours with the theme's own
    // colours and a contrast warning (1.37, UX-25).
    const renderers: FieldRenderers = {
      image: imageFieldRenderer({ session, picks: imagePicks }),
      link: linkFieldRenderer({ session }),
      icon: IconField,
      color: colourFieldRenderer({
        session,
        preferences,
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
    };
    function Edit() {
      return (
        <FieldRenderersProvider renderers={renderers}>
          <PreferredEditPanel
            session={session}
            preferences={preferences}
            flush={() => connectionRef.current?.flush()}
          />
        </FieldRenderersProvider>
      );
    }
    return panels.register({
      id: "edit",
      slot: "right.top",
      title: t("editPanel.title"),
      icon: SlidersHorizontalIcon,
      component: Edit,
    });
  }, [panels, session, preferences, imagePicks]);

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
      // Its favourites and recents (1.34), which it follows without being registered again (its
      // tab and + place stay).
      preferences,
      commands: registry,
      preview: previews,
    });
    addPanelRef.current = addPanel;
    return () => {
      addPanelRef.current = null;
      addPanel.remove();
    };
  }, [panels, session, mode, engine, siteWide, preferences, registry, previews]);
  useEffect(() => registerMediaPanel(panels, session), [panels, session]);
  // The selected element's own toolbar, in the row under the canvas toolbar (SP-4).
  useEffect(() => {
    const flush = () => connectionRef.current?.flush();
    const removeHeading = toolbars.register(headingToolbar({ session, flush }));
    const removeList = toolbars.register(listToolbar({ session, flush }));
    return () => {
      removeHeading();
      removeList();
    };
  }, [toolbars, session]);
  useEffect(
    () => toolbars.register(headerToolbar({ session, previews: editPreviews })),
    [toolbars, session, editPreviews],
  );
  useEffect(
    () =>
      toolbars.register(
        columnsToolbar({
          session,
          flush: () => connectionRef.current?.flush(),
          previews: editPreviews,
        }),
      ),
    [toolbars, session, editPreviews],
  );

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
