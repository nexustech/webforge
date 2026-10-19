import { t } from "@webforge/i18n";
import type { AppInfo } from "../shared/ipc-contract.js";

/** Props of {@link App}. */
export type AppProps = {
  readonly info: AppInfo;
};

/** Root component of the editor window. Placeholder until the editor UI lands. */
export function App({ info }: AppProps) {
  return (
    <main className="app">
      <h1 className="app__title">{t("app.name")}</h1>
      <p className="app__version">{t("app.version", { version: info.version })}</p>
    </main>
  );
}
