import { t } from "@webforge/i18n";
import { type SiteSnapshot, siteToSnapshot } from "@webforge/model";
import { siteLibrary } from "@webforge/site-components";
import { useEffect, useState } from "react";
import type { AppInfo, ExportResult } from "../shared/ipc-contract.js";
import { Editor, type EditorProps } from "./editor/Editor.js";
import { createEditorSession } from "./editor/editor-session.js";
import { starterSite } from "./editor/starter-site.js";
import { ExportButton } from "./export/ExportButton.js";

/** Props of {@link App}. */
export type AppProps = {
  readonly info: AppInfo;
  /** Creates the canvas engine; injectable for tests. */
  readonly createEngine?: EditorProps["createEngine"];
  /** Exports a site; injectable for tests. Defaults to the preload API. */
  readonly exportSite?: (snapshot: SiteSnapshot) => Promise<ExportResult>;
};

const exportWithPreload = (snapshot: SiteSnapshot) => window.webforge.site.export(snapshot);

/** Root component of the editor window. */
export function App({ info, createEngine, exportSite = exportWithPreload }: AppProps) {
  const [session] = useState(() => createEditorSession(siteLibrary, starterSite()));

  useEffect(() => {
    // Vite replaces MODE at build time, so normal builds drop this branch and the module with it.
    if (import.meta.env.MODE === "perf") {
      void import("./perf/perf-hooks.js").then((perf) => perf.installPerfHooks(session));
    }
  }, [session]);

  return (
    <div className="app">
      <header className="app__header">
        <h1 className="app__title">{t("app.name")}</h1>
        <p className="app__version">{t("app.version", { version: info.version })}</p>
        <ExportButton
          // No media yet (1.16 adds images and their bytes).
          onExport={() =>
            exportSite(siteToSnapshot(session.history.document.getState(), new Map()))
          }
        />
      </header>
      <Editor session={session} {...(createEngine === undefined ? {} : { createEngine })} />
    </div>
  );
}
