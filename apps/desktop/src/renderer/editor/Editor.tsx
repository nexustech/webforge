import { FieldRenderersProvider, toast } from "@webforge/editor-ui";
import {
  type CanvasEngine,
  createPuckEngine,
  type HistoryCommand,
  installHistoryKeys,
  type ViewOptions,
} from "@webforge/engine";
import { t } from "@webforge/i18n";
import { HistoryIcon, SlidersHorizontalIcon } from "lucide-react";
import { type RefObject, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { shallow } from "zustand/shallow";
import type { CustomDevice, EditPanelPreferences } from "../../shared/ipc/prefs.js";
import { createSectionPreviews } from "../add/index.js";
import { APPEARANCE_GROUP_ID, LOOK_COMMANDS } from "../clipboard/index.js";
import { CanvasElementMenu } from "../element-menu/CanvasElementMenu.js";
import { createErrorReporter, type ReportError } from "../error-reporting.js";
import { fieldRenderers } from "../fields/index.js";
import { RichTextLinkHost } from "../links/RichTextLinkHost.js";
import { createImagePickRequests } from "../media/image-picks.js";
import { SharedSectionNameDialog } from "../shared-sections/SharedSectionCommands.js";
import { widthOf } from "../shell/canvas-size.js";
import { type CanvasView, connectCanvasView } from "../shell/canvas-view.js";
import { useCommand, useCommandRegistry } from "../shell/command-context.js";
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
import { type Area, connectAreas, type EditorContext, type EditorDialogs } from "./areas.js";
import { CanvasBreadcrumbs } from "./CanvasBreadcrumbs.js";
import { CanvasResizeHandles } from "./CanvasResizeHandles.js";
import type { CanvasPointerHost } from "./canvas-pointer.js";
import { isDialogText } from "./dialog-keys.js";
import { EditPanelHost, type EditPanelHostProps } from "./EditPanelHost.js";
import { canvasPreviews, createPreviewStore } from "./edit-previews.js";
import {
  connectEngine,
  currentPage,
  type EditorSession,
  runHistoryCommand,
} from "./editor-session.js";
import { createEngineHost } from "./engine-host.js";
import type { ItemCssServices } from "./ItemCssView.js";
import type { Layer } from "./layers.js";
import { SharedRegionBanner } from "./SharedRegionBanner.js";
import { confirmSharedRemovals } from "./shared-confirmations.js";
import { shownLayout } from "./shared-layout.js";
import { type SharedSectionNaming, sharedSection } from "./shared-sections.js";
import type { CompileCanvasCss } from "./site-css.js";
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
  /**
   * The areas it registers around its canvas, in order (2.20, B1): `EDITOR_AREAS` from the
   * composition root, `renderer/areas.ts`.
   */
  readonly areas: readonly Area<EditorContext>[];
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
  /** What the window's panels point at on the canvas (SP-8, SP-10), shown on the engine. */
  readonly canvasPointer?: CanvasPointerHost;
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
/** The CSS tab's worker and clipboard (3.14), through the preload API when used. */
const itemCssWithPreload: Omit<ItemCssServices, "onOpenCustomCode"> = {
  api: {
    itemHtml: (request) => window.webforge.canvas.itemHtml(request),
    classCss: (theme, classes) => window.webforge.canvas.classCss(theme, classes),
  },
  copyText: (text) => window.webforge.clipboard.copyText(text),
};
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

/** The Theme tab's panel id (`theme/`'s THEME_PANEL_ID), which the editor area doesn't import. */
const THEME_PANEL = "theme";

/**
 * The Edit panel as the preferences have it: with the Advanced tab in Advanced mode, the Content
 * tab only in Content mode (R9), and the option groups the person closed (UX-13). The Appearance
 * group's right-click menu has *Apply Look to Every…* (2.27), the Edit menu's own commands, and the
 * Style tab *Style this ‹kind›…* (3.13a).
 */
function PreferredEditPanel({
  preferences,
  ...props
}: Omit<
  EditPanelHostProps,
  | "advanced"
  | "contentOnly"
  | "closedGroups"
  | "onClosedGroupsChange"
  | "groupActions"
  | "styleAction"
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
  const registry = useCommandRegistry();
  // The Appearance group's own actions (2.27): its look given to every other one of the kind.
  const onPage = useCommand(LOOK_COMMANDS.page);
  const onSite = useCommand(LOOK_COMMANDS.site);
  // The Style tab's *Style this ‹kind›…* (3.13a), while the selection has a look to style.
  const styleThis = useCommand(COMMAND_IDS.styleThis);
  // The Advanced tab's CSS points at Custom Code (3.14).
  const customCode = useCommand(COMMAND_IDS.customCode);
  const appearance = [onPage, onSite].flatMap((command) =>
    command === undefined
      ? []
      : [
          {
            label: command.label,
            enabled: command.enabled !== false,
            onSelect: () => void registry.run(command.id),
          },
        ],
  );
  return (
    <EditPanelHost
      {...props}
      groupActions={(id) => (id === APPEARANCE_GROUP_ID ? appearance : [])}
      styleAction={
        styleThis === undefined || styleThis.enabled === false
          ? undefined
          : { label: styleThis.label, onSelect: () => void registry.run(styleThis.id) }
      }
      advanced={advanced}
      contentOnly={contentOnly}
      itemCss={
        advanced
          ? {
              ...itemCssWithPreload,
              onOpenCustomCode:
                customCode === undefined ? undefined : () => void registry.run(customCode.id),
            }
          : undefined
      }
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
  // Desktop fills the canvas (PH2-18): its width is the one the canvas reports.
  const shown = useSyncExternalStore(view.subscribe, () => view.getState().size?.width);
  return (
    <CanvasResizeHandles
      container={container}
      width={widthOf(viewport, shown)}
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
  areas,
  createEngine = createPuckEngine,
  compileCss = compileWithPreload,
  reportError = reportWithPreload,
  preferences: givenPreferences,
  canvasView,
  canvasPointer,
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
  // The sections' larger previews in the Add panel (UX-10), drawn with the site's theme. Made once
  // for the editor's session, so the drawings they keep outlive the areas registering again.
  const [sectionPreviews] = useState(() =>
    createSectionPreviews({
      library: session.library,
      theme: () => session.history.document.getState().theme,
      sharedSection: (id) => sharedSection(session.history.document.getState(), id)?.section,
      compileCss,
    }),
  );
  // The canvas engine as the areas see it, while one is mounted (2.20, B1).
  const [host] = useState(createEngineHost);
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
  const { history } = session;
  const registry = useCommandRegistry();
  // The shared-section name the dialog asks for (saving or renaming one), while it is open.
  const [naming, setNaming] = useState<SharedSectionNaming | null>(null);
  // What an area's commands open: the dialogs above, and the Edit panel's image picker.
  const [dialogs] = useState<EditorDialogs>(() => ({
    nameSharedSection: setNaming,
    rename: setRenaming,
    pickImage: (nodeId) => pickImageRef.current(nodeId),
  }));
  const state = useSyncExternalStore(
    history.state.subscribe,
    history.state.getState,
    history.state.getState,
  );

  // Undo and Redo live in the title bar, the Edit menu and the command box (1.2); registered
  // before the canvas's own commands so they head the Edit menu.
  useEffect(() => {
    const runCommand = (command: HistoryCommand) => {
      host.flush();
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
  }, [registry, session, history, host]);
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
    engine.setLooks(site.theme.looks);
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
    setEngine(engine);
    // One handler for the whole window (U4); the engine reports keys pressed inside its iframe.
    const removeKeys = installHistoryKeys(
      window,
      (command) => {
        // Nothing changes while a question about the whole site waits for its answer (D7); Esc
        // goes to its dialog.
        if (siteWide !== undefined && siteWide.current() !== null) return false;
        connection.flush();
        return runHistoryCommand(session, command);
      },
      // Ctrl/Cmd+Z in a dialog's text undoes the text, not a step of the site behind it (#421
      // review); elsewhere in a dialog it is the site's.
      { ignore: (event) => isDialogText(event.target) },
    );
    // The areas' connections to the canvas, and their commands on it (2.20, B1).
    const detach = host.attach({ engine, connection });
    let removeFrameShortcuts: (() => void) | undefined;
    const stopFrameWindow = engine.onFrameWindow((frameWindow) => {
      removeFrameShortcuts?.();
      removeFrameShortcuts =
        frameWindow === null ? undefined : installCommandShortcuts(frameWindow, registry);
    });

    return () => {
      setEngine(null);
      stopFrameWindow();
      removeFrameShortcuts?.();
      detach();
      removeKeys();
      connection.disconnect();
      engine.destroy();
      element.remove();
    };
  }, [
    session,
    history,
    createEngine,
    reportError,
    registry,
    siteWide,
    preferences,
    editPreviews,
    host,
  ]);

  // Each kind's look from the theme (3.12, CT-1): the canvas draws again only when they change.
  useEffect(() => {
    if (engine === null) return;
    const show = () => engine.setLooks(history.document.getState().theme.looks);
    show();
    return history.document.subscribe(show);
  }, [engine, history]);

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
  }, [engine, mode]);

  useEffect(
    () =>
      engine === null || canvasView === undefined
        ? undefined
        : connectCanvasView(engine, canvasView),
    [engine, canvasView],
  );
  useEffect(
    () => (engine === null ? undefined : canvasPointer?.connect(engine)),
    [engine, canvasPointer],
  );

  // "Deleted Heading · Undo" after each delete (D4, 1.11).
  useEffect(
    () =>
      installUndoToasts(
        session,
        { show: (message, options) => toast(message, options), dismiss: (id) => toast.dismiss(id) },
        () => host.flush(),
      ),
    [session, host],
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
          host.flush();
          return history.jumpTo(entryId);
        }),
      }),
    [panels, history, host],
  );

  // The Edit panel replaces Puck's own fields (1.14). Registered once: it follows the editor level
  // and the mode (Content shows its Content tab only) itself, so a switch redraws it alone (R9).
  useEffect(() => {
    // The fields the app draws itself (R11, fields/): images, links, icons, and colours with the
    // theme's own colours and a contrast warning (1.37, UX-25).
    const renderers = fieldRenderers({ session, preferences, imagePicks });
    function Edit() {
      return (
        <FieldRenderersProvider renderers={renderers}>
          <PreferredEditPanel
            session={session}
            preferences={preferences}
            flush={() => host.flush()}
            // An Appearance field's source shows in the Theme tab, or a kind's look in Theme
            // Studio, which the Theme tab's registration opens (3.12, CT-3).
            revealSource={(target) => panels.show(THEME_PANEL, target)}
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
  }, [panels, session, preferences, imagePicks, host]);

  // The areas' panels, commands, toolbars and connections to the canvas (2.20, B1), in the order
  // of the composition root's list. Each follows the mode itself, through the preferences.
  useEffect(
    () =>
      connectAreas(areas, {
        session,
        commands: registry,
        panels,
        toolbars,
        preferences,
        engine: host,
        ...(siteWide === undefined ? {} : { siteWide }),
        compileCss,
        sectionPreviews,
        editPreviews,
        dialogs,
      }),
    [
      areas,
      session,
      registry,
      panels,
      toolbars,
      preferences,
      host,
      siteWide,
      compileCss,
      sectionPreviews,
      editPreviews,
      dialogs,
    ],
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
