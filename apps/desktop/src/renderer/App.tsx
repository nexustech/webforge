import { Toaster, TooltipProvider } from "@webforge/editor-ui";
import { type SiteSnapshot, siteToSnapshot } from "@webforge/model";
import { siteLibrary } from "@webforge/site-components";
import { useEffect, useState, useSyncExternalStore } from "react";
import type { AppInfo, ExportResult } from "../shared/ipc-contract.js";
import { Editor, type EditorProps } from "./editor/Editor.js";
import { createEditorSession } from "./editor/editor-session.js";
import { starterSite } from "./editor/starter-site.js";
import { registerExportCommand } from "./export/export-command.js";
import { AboutDialog } from "./shell/AboutDialog.js";
import { CommandRegistryProvider } from "./shell/command-context.js";
import { createCommandRegistry, installCommandShortcuts } from "./shell/commands.js";
import { TitleBar } from "./shell/TitleBar.js";
import { AutosaveStatus } from "./storage/AutosaveStatus.js";
import { registerCrashReportsCommand } from "./storage/crash-reports-command.js";
import type { LoadedSite } from "./storage/load-site.js";

/** Props of {@link App}. */
export type AppProps = {
  readonly info: AppInfo;
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

/** Root component of the editor window: the title bar over the editor. */
export function App({
  info,
  createEngine,
  compileCss,
  exportSite = exportWithPreload,
  loaded,
}: AppProps) {
  const [session] = useState(() => createEditorSession(siteLibrary, loaded?.site ?? starterSite()));
  const [registry] = useState(createCommandRegistry);
  const siteName = useSyncExternalStore(
    session.history.document.subscribe,
    () => session.history.document.getState().settings.general.name,
  );

  useEffect(() => installCommandShortcuts(window, registry), [registry]);
  useEffect(() => registerCrashReportsCommand(registry), [registry]);

  useEffect(
    () =>
      registerExportCommand(registry, () =>
        // No media yet (1.16 adds images and their bytes).
        exportSite(siteToSnapshot(session.history.document.getState(), new Map())),
      ),
    [registry, session, exportSite],
  );

  useEffect(() => {
    // Vite replaces MODE at build time, so normal builds drop this branch and the module with it.
    if (import.meta.env.MODE === "perf") {
      void import("./perf/perf-hooks.js").then((perf) => perf.installPerfHooks(session));
    }
  }, [session]);

  return (
    <CommandRegistryProvider registry={registry}>
      <TooltipProvider>
        <div className="flex h-full flex-col">
          <TitleBar
            siteName={siteName}
            saveStatus={<AutosaveStatus session={session} loaded={loaded} />}
          />
          <main className="min-h-0 flex-1">
            <Editor
              session={session}
              {...(createEngine === undefined ? {} : { createEngine })}
              {...(compileCss === undefined ? {} : { compileCss })}
            />
          </main>
        </div>
        <AboutDialog info={info} />
        <Toaster theme="dark" />
      </TooltipProvider>
    </CommandRegistryProvider>
  );
}
