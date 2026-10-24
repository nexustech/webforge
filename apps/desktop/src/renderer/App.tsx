import { type ResizableLayout, Toaster, TooltipProvider } from "@webforge/editor-ui";
import type { EditorMode } from "@webforge/engine";
import { t } from "@webforge/i18n";
import { siteLibrary } from "@webforge/site-components";
import { PanelBottomIcon, PanelLeftIcon, PanelRightIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { applyPreferencesChange } from "../shared/ipc/prefs.js";
import type { ExportRequest } from "../shared/ipc/site.js";
import type {
  AppInfo,
  ExportResult,
  Preferences,
  PreferencesChange,
  SiteUiState,
  UiStateResult,
} from "../shared/ipc-contract.js";
import { Editor, type EditorProps, type UndoTo } from "./editor/Editor.js";
import { createEditorSession, type EditorSession } from "./editor/editor-session.js";
import { starterSite } from "./editor/starter-site.js";
import { useDocument } from "./editor/use-document.js";
import { registerExportCommand } from "./export/export-command.js";
import { exportRequestFor } from "./export/export-request.js";
import { registerLayersPanel } from "./layers/register-layers-panel.js";
import { AboutDialog } from "./shell/AboutDialog.js";
import { CanvasToolbarHost } from "./shell/CanvasToolbarHost.js";
import { CommandButton } from "./shell/CommandButton.js";
import { createCanvasView } from "./shell/canvas-view.js";
import { CommandRegistryProvider } from "./shell/command-context.js";
import { COMMAND_IDS } from "./shell/command-ids.js";
import { createCommandRegistry, installCommandShortcuts } from "./shell/commands.js";
import {
  createSiteWideConfirm,
  pauseCommandsWhileAsking,
  SiteWideConfirmDialog,
} from "./shell/confirm-site-wide.js";
import { ModeToggle } from "./shell/ModeToggle.js";
import { PanelRegistryProvider } from "./shell/panel-context.js";
import { createPanelRegistry } from "./shell/panels.js";
import { ShellLayout } from "./shell/ShellLayout.js";
import { ShortcutSheet } from "./shell/ShortcutSheet.js";
import { TitleBar } from "./shell/TitleBar.js";
import { UndoStepsMenu } from "./shell/UndoStepsMenu.js";
import { registerViewCommands } from "./shell/view-commands.js";
import { registerPageCommands } from "./site/page-commands.js";
import { registerSitePanel } from "./site/SitePanel.js";
import { SiteSettingsHost } from "./site-settings/SiteSettingsHost.js";
import { SiteCommands } from "./start/SiteCommands.js";
import { AutosaveStatus } from "./storage/AutosaveStatus.js";
import { registerCrashReportsCommand } from "./storage/crash-reports-command.js";
import type { LoadedSite } from "./storage/load-site.js";
import { siteSession } from "./storage/site-session.js";

/** Props of {@link App}. */
export type AppProps = {
  readonly info: AppInfo;
  /** The person's preferences as main loaded them. */
  readonly preferences: Preferences;
  /** Saves changed preferences; injectable for tests. Defaults to the preload API. */
  readonly savePreferences?: (change: PreferencesChange) => Promise<Preferences>;
  /** Creates the canvas engine; injectable for tests. */
  readonly createEngine?: EditorProps["createEngine"];
  /** Compiles the canvas's site CSS; injectable for tests. */
  readonly compileCss?: EditorProps["compileCss"];
  /** Exports a site; injectable for tests. Defaults to the preload API. */
  readonly exportSite?: (request: ExportRequest) => Promise<ExportResult>;
  /** The site read from the open site file at start-up (1.6); the starter site otherwise. */
  readonly loaded?: LoadedSite;
  /** The open site's editor state (Design or Content mode) as main loaded it; none for no site. */
  readonly uiState?: SiteUiState | null;
  /** Remembers the editor state with the open site; injectable for tests. */
  readonly saveUiState?: (state: SiteUiState) => Promise<UiStateResult>;
  /** Spell checks text in the site's language (F-ED-19); injectable for tests. */
  readonly setSpellCheckLanguage?: (language: string) => Promise<null>;
};

const exportWithPreload = (request: ExportRequest) => window.webforge.site.export(request);
const saveWithPreload = (change: PreferencesChange) => window.webforge.prefs.set(change);
const saveUiStateWithPreload = (state: SiteUiState) =>
  window.webforge.project.setUiState(siteSession(), state);
const spellCheckWithPreload = (language: string) =>
  window.webforge.app.setSpellCheckLanguage(language);

/** The perf check's hooks (ADR 0007), loaded only in perf builds. */
const installPerf = (session: EditorSession) => {
  void import("./perf/perf-hooks.js").then((perf) => perf.installPerfHooks(session));
};

/** Root component of the editor window: the title bar over the panel layout and canvas. */
export function App({
  info,
  preferences: initialPreferences,
  savePreferences = saveWithPreload,
  createEngine,
  compileCss,
  exportSite = exportWithPreload,
  loaded,
  uiState,
  saveUiState = saveUiStateWithPreload,
  setSpellCheckLanguage = spellCheckWithPreload,
}: AppProps) {
  const [session] = useState(() => createEditorSession(siteLibrary, loaded?.site ?? starterSite()));
  const [registry] = useState(createCommandRegistry);
  const [panels] = useState(createPanelRegistry);
  const [canvasView] = useState(createCanvasView);
  // Actions that change more than the page shown ask first (D7); one dialog for the window.
  const [siteWide] = useState(createSiteWideConfirm);
  const [preferences, setPreferences] = useState(initialPreferences);
  // Design or Content (M3): remembered with the open site, never an undo step.
  const [mode, setMode] = useState<EditorMode>(uiState?.editorMode ?? "design");
  // How the title bar's list of steps undoes back to one, which the editor hands over (UX-16).
  const [undoTo, setUndoTo] = useState<UndoTo | null>(null);
  // The latest preferences, for changes made before React re-renders (several groups at once).
  const latest = useRef(preferences);
  const siteName = useDocument(session, (site) => site.settings.general.name);
  const siteLanguage = useDocument(session, (site) => site.settings.general.language);
  // Spelling is checked in the site's language, including after Site Settings changes it (1.22).
  useEffect(() => {
    setSpellCheckLanguage(siteLanguage).catch((error: unknown) => {
      console.error("Webforge could not set the spell-check language", error);
    });
  }, [setSpellCheckLanguage, siteLanguage]);

  const change = (update: PreferencesChange) => {
    latest.current = applyPreferencesChange(latest.current, update);
    setPreferences(latest.current);
    savePreferences(update).catch((error: unknown) => {
      console.error("Webforge could not save the preferences", error);
    });
  };

  const changeMode = (next: EditorMode) => {
    setMode(next);
    // Without an open site (the starter site) the mode lasts until the window closes.
    saveUiState({ editorMode: next }).catch((error: unknown) => {
      console.error("Webforge could not remember the editor mode", error);
    });
  };

  const { theme, editorLevel } = preferences;
  // The View menu's options as the canvas takes them (the compiler keeps the object until one
  // changes; without it, the canvas is just told the same options again).
  const { showOutlines, spacingOnHover, elementNames, extraBottomSpace } = preferences.canvas;
  const viewOptions = { outlines: showOutlines, spacingOnHover, elementNames, extraBottomSpace };
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => installCommandShortcuts(window, registry), [registry]);
  useEffect(() => pauseCommandsWhileAsking(siteWide, registry), [siteWide, registry]);
  useEffect(() => registerSitePanel(panels, session, siteWide), [panels, session, siteWide]);
  // The command palette's Go to page (1.34, F-ED-26).
  useEffect(() => registerPageCommands(registry, session), [registry, session]);
  // Content mode locks the layout in Layers too (M3).
  useEffect(
    () => registerLayersPanel(panels, session, { layoutLocked: mode !== "design" }),
    [panels, session, mode],
  );
  useEffect(() => registerCrashReportsCommand(registry), [registry]);
  // View → Zoom In/Out, Actual Size, Zoom to Fit and the device views (F-ED-27).
  useEffect(
    () => registerViewCommands(registry, session, canvasView),
    [registry, session, canvasView],
  );

  useEffect(
    () =>
      registerExportCommand(registry, () =>
        exportSite(exportRequestFor(session.history.document.getState(), siteLibrary)),
      ),
    [registry, session, exportSite],
  );

  // View → Use Light/Dark Theme. `change` is recreated each render; the ref keeps it current.
  const changeRef = useRef(change);
  useEffect(() => {
    changeRef.current = change;
  });
  useEffect(
    () =>
      registry.register({
        id: COMMAND_IDS.theme,
        label: theme === "dark" ? t("command.lightTheme") : t("command.darkTheme"),
        menu: "view",
        run: () => changeRef.current({ theme: theme === "dark" ? "light" : "dark" }),
      }),
    [registry, theme],
  );

  // View → Switch to Design/Content Mode, and Use Simple/Advanced Mode (T2: per person).
  const changeModeRef = useRef(changeMode);
  useEffect(() => {
    changeModeRef.current = changeMode;
  });
  useEffect(
    () =>
      registry.register({
        id: COMMAND_IDS.editorMode,
        label: mode === "design" ? t("command.contentMode") : t("command.designMode"),
        menu: "view",
        run: () => changeModeRef.current(mode === "design" ? "content" : "design"),
      }),
    [registry, mode],
  );
  useEffect(
    () =>
      registry.register({
        id: COMMAND_IDS.editorLevel,
        label: editorLevel === "simple" ? t("command.advancedMode") : t("command.simpleMode"),
        menu: "view",
        run: () =>
          changeRef.current({ editorLevel: editorLevel === "simple" ? "advanced" : "simple" }),
      }),
    [registry, editorLevel],
  );

  useEffect(() => {
    // Vite replaces MODE at build time, so normal builds drop this branch and the module with it.
    if (import.meta.env.MODE === "perf") installPerf(session);
  }, [session]);

  const rememberLayout = (groupId: string, layout: ResizableLayout) =>
    change({ panelLayout: { ...latest.current.panelLayout, [groupId]: layout } });

  return (
    <CommandRegistryProvider registry={registry}>
      <PanelRegistryProvider registry={panels}>
        <TooltipProvider>
          <div className="flex h-full flex-col">
            <TitleBar
              siteName={siteName}
              saveStatus={<AutosaveStatus session={session} loaded={loaded} />}
              undoSteps={<UndoStepsMenu state={session.history.state} undoTo={undoTo?.run} />}
              tools={
                <>
                  <ModeToggle mode={mode} onModeChange={changeMode} />
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
                layout={preferences.panelLayout}
                onLayoutChange={rememberLayout}
                editorLevel={editorLevel}
                center={
                  <div className="flex h-full flex-col">
                    <CanvasToolbarHost
                      session={session}
                      view={canvasView}
                      canvas={preferences.canvas}
                      onCanvasChange={(canvas) => change({ canvas })}
                    />
                    <div className="min-h-0 flex-1">
                      <Editor
                        session={session}
                        {...(createEngine === undefined ? {} : { createEngine })}
                        {...(compileCss === undefined ? {} : { compileCss })}
                        mode={mode}
                        siteWide={siteWide}
                        canvasView={canvasView}
                        editorLevel={editorLevel}
                        devices={preferences.canvas.devices}
                        viewOptions={viewOptions}
                        addPreferences={preferences.add}
                        onAddPreferencesChange={(add) => change({ add })}
                        onUndoTo={setUndoTo}
                      />
                    </div>
                  </div>
                }
              />
            </main>
          </div>
          <AboutDialog info={info} />
          <ShortcutSheet />
          <SiteCommands />
          <SiteSettingsHost session={session} />
          <SiteWideConfirmDialog confirm={siteWide} />
          <Toaster theme={theme} />
        </TooltipProvider>
      </PanelRegistryProvider>
    </CommandRegistryProvider>
  );
}
