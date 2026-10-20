import { type ResizableLayout, Toaster, TooltipProvider } from "@webforge/editor-ui";
import { t } from "@webforge/i18n";
import { type SiteSnapshot, siteToSnapshot } from "@webforge/model";
import { siteLibrary } from "@webforge/site-components";
import { PanelBottomIcon, PanelLeftIcon, PanelRightIcon } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { applyPreferencesChange } from "../shared/ipc/prefs.js";
import type {
  AppInfo,
  ExportResult,
  Preferences,
  PreferencesChange,
} from "../shared/ipc-contract.js";
import { Editor, type EditorProps } from "./editor/Editor.js";
import { createEditorSession } from "./editor/editor-session.js";
import { starterSite } from "./editor/starter-site.js";
import { registerExportCommand } from "./export/export-command.js";
import { AboutDialog } from "./shell/AboutDialog.js";
import { CommandButton } from "./shell/CommandButton.js";
import { CommandRegistryProvider } from "./shell/command-context.js";
import { COMMAND_IDS } from "./shell/command-ids.js";
import { createCommandRegistry, installCommandShortcuts } from "./shell/commands.js";
import { PanelRegistryProvider } from "./shell/panel-context.js";
import { createPanelRegistry } from "./shell/panels.js";
import { ShellLayout } from "./shell/ShellLayout.js";
import { TitleBar } from "./shell/TitleBar.js";
import { AutosaveStatus } from "./storage/AutosaveStatus.js";
import type { LoadedSite } from "./storage/load-site.js";

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
  readonly exportSite?: (snapshot: SiteSnapshot) => Promise<ExportResult>;
  /** The site read from the open site file at start-up (1.6); the starter site otherwise. */
  readonly loaded?: LoadedSite;
};

const exportWithPreload = (snapshot: SiteSnapshot) => window.webforge.site.export(snapshot);
const saveWithPreload = (change: PreferencesChange) => window.webforge.prefs.set(change);

/** Root component of the editor window: the title bar over the panel layout and canvas. */
export function App({
  info,
  preferences: initialPreferences,
  savePreferences = saveWithPreload,
  createEngine,
  compileCss,
  exportSite = exportWithPreload,
  loaded,
}: AppProps) {
  const [session] = useState(() => createEditorSession(siteLibrary, loaded?.site ?? starterSite()));
  const [registry] = useState(createCommandRegistry);
  const [panels] = useState(createPanelRegistry);
  const [preferences, setPreferences] = useState(initialPreferences);
  // The latest preferences, for changes made before React re-renders (several groups at once).
  const latest = useRef(preferences);
  const siteName = useSyncExternalStore(
    session.history.document.subscribe,
    () => session.history.document.getState().settings.general.name,
  );

  const change = (update: PreferencesChange) => {
    latest.current = applyPreferencesChange(latest.current, update);
    setPreferences(latest.current);
    savePreferences(update).catch((error: unknown) => {
      console.error("Webforge could not save the preferences", error);
    });
  };

  const { theme } = preferences;
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => installCommandShortcuts(window, registry), [registry]);

  useEffect(
    () =>
      registerExportCommand(registry, () =>
        // No media yet (1.16 adds images and their bytes).
        exportSite(siteToSnapshot(session.history.document.getState(), new Map())),
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

  useEffect(() => {
    // Vite replaces MODE at build time, so normal builds drop this branch and the module with it.
    if (import.meta.env.MODE === "perf") {
      void import("./perf/perf-hooks.js").then((perf) => perf.installPerfHooks(session));
    }
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
              tools={
                <>
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
                editorLevel={preferences.editorLevel}
                center={
                  <Editor
                    session={session}
                    {...(createEngine === undefined ? {} : { createEngine })}
                    {...(compileCss === undefined ? {} : { compileCss })}
                  />
                }
              />
            </main>
          </div>
          <AboutDialog info={info} />
          <Toaster theme={theme} />
        </TooltipProvider>
      </PanelRegistryProvider>
    </CommandRegistryProvider>
  );
}
