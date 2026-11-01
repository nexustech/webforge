import { type ResizableLayout, Toaster, TooltipProvider, toast } from "@webforge/editor-ui";
import { t } from "@webforge/i18n";
import { siteLibrary } from "@webforge/site-components";
import { PanelBottomIcon, PanelLeftIcon, PanelRightIcon } from "lucide-react";
import { useEffect, useState } from "react";
import type { AppInfo, Preferences, SiteUiState } from "../shared/ipc-contract.js";
import { starterSite } from "../shared/starter-site.js";
import type { WebforgeApi } from "../shared/webforge-api.js";
import { createItemPreviews, createKindPreviews } from "./add/index.js";
import { EDITOR_AREAS, WINDOW_AREAS } from "./areas.js";
import { connectAreas, type WindowContext } from "./editor/areas.js";
import { createCanvasPointer } from "./editor/canvas-pointer.js";
import { createCodeTrust } from "./editor/code-trust.js";
import { Editor, type EditorProps } from "./editor/Editor.js";
import { createEditorSession, type EditorSession } from "./editor/editor-session.js";
import { createSettingsRegistry } from "./editor/settings-registry.js";
import { useDocument } from "./editor/use-document.js";
import { reportFailure } from "./log.js";
import { SettingsHost } from "./settings/SettingsHost.js";
import { AboutDialog } from "./shell/AboutDialog.js";
import { CanvasToolbarHost } from "./shell/CanvasToolbarHost.js";
import { CommandButton } from "./shell/CommandButton.js";
import { createCanvasView } from "./shell/canvas-view.js";
import { CommandRegistryProvider } from "./shell/command-context.js";
import { COMMAND_IDS } from "./shell/command-ids.js";
import { createCommandRegistry, installCommandShortcuts, isMac } from "./shell/commands.js";
import {
  createSiteWideConfirm,
  pauseCommandsWhileAsking,
  SiteWideConfirmDialog,
} from "./shell/confirm-site-wide.js";
import { ContextualToolbarsProvider } from "./shell/contextual-toolbar-context.js";
import { createContextualToolbars } from "./shell/contextual-toolbars.js";
import { ModeToggle } from "./shell/ModeToggle.js";
import { PanelRegistryProvider } from "./shell/panel-context.js";
import { createPanelRegistry } from "./shell/panels.js";
import { createPreferencesStore, usePreferences } from "./shell/preferences-store.js";
import { ShellLayout } from "./shell/ShellLayout.js";
import { ShortcutSheet } from "./shell/ShortcutSheet.js";
import { TitleBar } from "./shell/TitleBar.js";
import { UndoStepsMenu } from "./shell/UndoStepsMenu.js";
import { createWindowDialogs, WindowDialogs } from "./shell/window-dialogs.js";
import { jumpTo } from "./site-check/index.js";
import { SiteCommands } from "./start/SiteCommands.js";
import { AutosaveStatus } from "./storage/AutosaveStatus.js";
import type { LoadedSite } from "./storage/load-site.js";
import { siteSession } from "./storage/site-session.js";

/** Props of {@link App}. */
export type AppProps = {
  readonly info: AppInfo;
  /** The person's preferences as main loaded them. */
  readonly preferences: Preferences;
  /**
   * The main process, through the preload API (#668): the areas' only way to it. Defaults to
   * `window.webforge`; tests give `fakePreloadApi()`. Fixed for the window's life: its areas
   * register once.
   */
  readonly api?: WebforgeApi;
  /** Creates the canvas engine; injectable for tests. */
  readonly createEngine?: EditorProps["createEngine"];
  /** The site read from the open site file at start-up (1.6); the starter site otherwise. */
  readonly loaded?: LoadedSite;
  /** The open site's editor state (Design or Content mode) as main loaded it; none for no site. */
  readonly uiState?: SiteUiState | null;
};

/** The perf check's hooks (ADR 0007), loaded only in perf builds. */
const installPerf = (session: EditorSession) => {
  void import("./perf/perf-hooks.js").then((perf) => perf.installPerfHooks(session));
};

/** Root component of the editor window: the title bar over the panel layout and canvas. */
export function App({
  info,
  preferences: initialPreferences,
  api: givenApi,
  createEngine,
  loaded,
  uiState,
}: AppProps) {
  const [api] = useState(() => givenApi ?? window.webforge);
  const [session] = useState(() => createEditorSession(siteLibrary, loaded?.site ?? starterSite()));
  const [registry] = useState(createCommandRegistry);
  const [panels] = useState(createPanelRegistry);
  const [toolbars] = useState(createContextualToolbars);
  const [canvasView] = useState(createCanvasView);
  const [canvasPointer] = useState(createCanvasPointer);
  const [settings] = useState(createSettingsRegistry);
  const [windowDialogs] = useState(createWindowDialogs);
  // Actions that change more than the page shown ask first (D7); one dialog for the window.
  const [siteWide] = useState(createSiteWideConfirm);
  // The person's preferences, and Design or Content mode (M3) remembered with the open site (R9).
  const [preferences] = useState(() =>
    createPreferencesStore(
      { preferences: initialPreferences, mode: uiState?.editorMode ?? "design" },
      {
        preferences: (change) => api.prefs.set(change),
        mode: (editorMode) => api.project.setUiState(siteSession(), { editorMode }),
      },
    ),
  );
  const mode = usePreferences(preferences, (state) => state.mode);
  const theme = usePreferences(preferences, (state) => state.preferences.theme);
  const editorLevel = usePreferences(preferences, (state) => state.preferences.editorLevel);
  const panelLayout = usePreferences(preferences, (state) => state.preferences.panelLayout);
  const siteName = useDocument(session, (site) => site.settings.general.name);
  const siteLanguage = useDocument(session, (site) => site.settings.general.language);
  // Spelling is checked in the site's language, including after Site Settings changes it (1.22).
  useEffect(() => {
    api.app.setSpellCheckLanguage(siteLanguage).catch((error: unknown) => {
      reportFailure("spellcheck.language", error);
    });
  }, [api, siteLanguage]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => installCommandShortcuts(window, registry), [registry]);
  useEffect(() => pauseCommandsWhileAsking(siteWide, registry), [siteWide, registry]);
  // The window's areas (2.20, B1): the Site and Layers panels, Go to page, Open Crash Reports,
  // the View menu's zoom and device views, and Export, after the shell's own commands. Their
  // context is made once, so they register once; they reach main through its `api` (#668).
  const [windowContext] = useState<WindowContext>(() => {
    // What the kind and item previews draw with: the canvas's CSS compiler, as the Add panel's.
    const previewSource = {
      library: session.library,
      theme: () => session.history.document.getState().theme,
      compileCss: (request) => api.canvas.compileCss(request),
      // A preview shown draws again as the theme changes (#613).
      subscribe: (listener: () => void) => session.history.document.subscribe(listener),
    } satisfies Parameters<typeof createKindPreviews>[0];
    return {
      api,
      session,
      commands: registry,
      panels,
      preferences,
      siteWide,
      canvasView,
      canvasPointer,
      settings,
      windowDialogs,
      // Drawn by the canvas's CSS compiler, as the Add panel's previews are.
      kindPreviews: createKindPreviews(previewSource),
      itemPreviews: createItemPreviews(previewSource),
      codeTrust: createCodeTrust({
        api: api.trust,
        session,
        sessionId: siteSession,
        // Review: Settings' Custom Code, or the element, as Site Check shows a finding there.
        review: (piece) =>
          jumpTo(
            piece.kind === "element"
              ? { kind: "element", on: piece.on, nodeId: piece.nodeId }
              : { kind: "code", part: piece.kind === "code" ? piece.part : "head" },
            { session, panels, settings, commands: registry, openGuide: () => {} },
          ),
        notify: () => toast.error(t("site.code.trust.failed")),
      }),
      siteCheckIgnored: {
        initial: uiState?.siteCheckIgnored ?? [],
        save: (ignored) => {
          api.project
            .setUiState(siteSession(), { siteCheckIgnored: [...ignored] })
            .catch((error: unknown) => {
              reportFailure("siteCheck.ignored", error);
            });
        },
      },
    };
  });
  useEffect(() => connectAreas(WINDOW_AREAS, windowContext), [windowContext]);

  // View → Use Light/Dark Appearance (the editor's look, not the site's theme), labelled for the theme shown; it reads that when it runs.
  useEffect(
    () =>
      registry.register({
        id: COMMAND_IDS.theme,
        label: theme === "dark" ? t("command.lightAppearance") : t("command.darkAppearance"),
        menu: "view",
        run: () => {
          const shown = preferences.getState().preferences.theme;
          preferences.change({ theme: shown === "dark" ? "light" : "dark" });
        },
      }),
    [registry, preferences, theme],
  );

  // View → Switch to Design/Content Mode, and Use Simple/Advanced Mode (T2: per person).
  useEffect(
    () =>
      registry.register({
        id: COMMAND_IDS.editorMode,
        label: mode === "design" ? t("command.contentMode") : t("command.designMode"),
        menu: "view",
        run: () =>
          preferences.changeMode(preferences.getState().mode === "design" ? "content" : "design"),
      }),
    [registry, preferences, mode],
  );
  useEffect(
    () =>
      registry.register({
        id: COMMAND_IDS.editorLevel,
        label: editorLevel === "simple" ? t("command.advancedMode") : t("command.simpleMode"),
        menu: "view",
        run: () => {
          const shown = preferences.getState().preferences.editorLevel;
          preferences.change({ editorLevel: shown === "simple" ? "advanced" : "simple" });
        },
      }),
    [registry, preferences, editorLevel],
  );

  useEffect(() => {
    // Vite replaces MODE at build time, so normal builds drop this branch and the module with it.
    if (import.meta.env.MODE === "perf") installPerf(session);
  }, [session]);

  const rememberLayout = (groupId: string, layout: ResizableLayout) =>
    preferences.change({
      panelLayout: { ...preferences.getState().preferences.panelLayout, [groupId]: layout },
    });

  return (
    <CommandRegistryProvider registry={registry}>
      <PanelRegistryProvider registry={panels}>
        <ContextualToolbarsProvider registry={toolbars}>
          <TooltipProvider>
            <div className="flex h-full flex-col">
              <TitleBar
                siteName={siteName}
                // On macOS the menus are the menu bar's (LF-13).
                menuBar={isMac() ? api.app : undefined}
                saveStatus={<AutosaveStatus session={session} loaded={loaded} api={api} />}
                undoSteps={
                  <UndoStepsMenu
                    state={session.history.state}
                    undoTo={(entryId) => session.undoTo(entryId)}
                  />
                }
                tools={
                  <>
                    <ModeToggle mode={mode} onModeChange={(next) => preferences.changeMode(next)} />
                    <div className="mx-1 h-5 w-px bg-border" aria-hidden />
                    <CommandButton
                      commandId={COMMAND_IDS.toggleLeftPanels}
                      icon={<PanelLeftIcon />}
                      label={t("command.toggleLeftPanels")}
                    />
                    <CommandButton
                      commandId={COMMAND_IDS.toggleDrawer}
                      icon={<PanelBottomIcon />}
                      label={t("command.toggleDrawer")}
                    />
                    <CommandButton
                      commandId={COMMAND_IDS.toggleRightPanels}
                      icon={<PanelRightIcon />}
                      label={t("command.toggleRightPanels")}
                    />
                    <div className="mx-1 h-5 w-px bg-border" aria-hidden />
                  </>
                }
              />
              <main className="min-h-0 flex-1">
                <ShellLayout
                  layout={panelLayout}
                  onLayoutChange={rememberLayout}
                  editorLevel={editorLevel}
                  center={
                    <div className="flex h-full flex-col">
                      <CanvasToolbarHost
                        session={session}
                        view={canvasView}
                        preferences={preferences}
                      />
                      <div className="min-h-0 flex-1">
                        <Editor
                          session={session}
                          api={api}
                          areas={EDITOR_AREAS}
                          {...(createEngine === undefined ? {} : { createEngine })}
                          preferences={preferences}
                          siteWide={siteWide}
                          canvasView={canvasView}
                          canvasPointer={canvasPointer}
                        />
                      </div>
                    </div>
                  }
                />
              </main>
            </div>
            <AboutDialog info={info} />
            <ShortcutSheet />
            <SiteCommands project={api.project} templates={api.templates} />
            <SettingsHost registry={settings} />
            <WindowDialogs registry={windowDialogs} />
            <SiteWideConfirmDialog confirm={siteWide} />
            <Toaster theme={theme} />
          </TooltipProvider>
        </ContextualToolbarsProvider>
      </PanelRegistryProvider>
    </CommandRegistryProvider>
  );
}
