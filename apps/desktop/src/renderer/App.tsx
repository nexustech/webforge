import { t } from "@webforge/i18n";
import { useState } from "react";
import type { AppInfo } from "../shared/ipc-contract.js";
import { Editor, type EditorProps } from "./editor/Editor.js";
import { createEditorSession } from "./editor/editor-session.js";
import { spikeLibrary, starterPage } from "./editor/library.js";

/** Props of {@link App}. */
export type AppProps = {
  readonly info: AppInfo;
  /** Creates the canvas engine; injectable for tests. */
  readonly createEngine?: EditorProps["createEngine"];
};

/** Root component of the editor window. */
export function App({ info, createEngine }: AppProps) {
  const [session] = useState(() => createEditorSession(spikeLibrary, starterPage()));

  return (
    <div className="app">
      <header className="app__header">
        <h1 className="app__title">{t("app.name")}</h1>
        <p className="app__version">{t("app.version", { version: info.version })}</p>
      </header>
      <Editor session={session} {...(createEngine === undefined ? {} : { createEngine })} />
    </div>
  );
}
