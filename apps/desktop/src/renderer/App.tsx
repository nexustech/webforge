import { t } from "@webforge/i18n";
import type { SiteSnapshot } from "@webforge/model";
import { siteLibrary, starterPage } from "@webforge/site-components";
import { useState } from "react";
import type { AppInfo, ExportResult } from "../shared/ipc-contract.js";
import { Editor, type EditorProps } from "./editor/Editor.js";
import { createEditorSession } from "./editor/editor-session.js";
import { ExportButton } from "./export/ExportButton.js";
import { singlePageSnapshot } from "./export/site-snapshot.js";

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
  const [session] = useState(() => createEditorSession(siteLibrary, starterPage()));

  return (
    <div className="app">
      <header className="app__header">
        <h1 className="app__title">{t("app.name")}</h1>
        <p className="app__version">{t("app.version", { version: info.version })}</p>
        <ExportButton
          onExport={() =>
            exportSite(
              singlePageSnapshot(t("site.untitledName"), session.history.document.getState().page),
            )
          }
        />
      </header>
      <Editor session={session} {...(createEngine === undefined ? {} : { createEngine })} />
    </div>
  );
}
