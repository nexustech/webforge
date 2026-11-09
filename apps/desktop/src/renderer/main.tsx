import { installMenuKeys } from "@webforge/engine";
import { t } from "@webforge/i18n";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { starterSite } from "../shared/starter-site.js";
import { App } from "./App.js";
import { createErrorReporter, installErrorReporting, rootErrorOptions } from "./error-reporting.js";
import { StartScreen } from "./start/StartScreen.js";
// Schemas word their problems in the editor's words (2.21).
import "./shell/form-messages.js";
import { applyTheme, markFirstRender, StartFailed } from "./startup.js";
import { loadSite } from "./storage/load-site.js";
import "./styles.css";
import { setFailureLog, showInDevConsole } from "./log.js";

// Bootstrap only; App is unit-tested and E2E tests cover this file.

const container = document.getElementById("root");
if (container === null) {
  throw new Error("Missing #root element in index.html");
}

// Errors become local crash reports (R3), from the first moment: names and frames, no messages.
const reportError = createErrorReporter(window.webforge.app.reportError);
installErrorReporting(window, reportError);
// Failures the editor handles go into the app's log, by code (R12).
setFailureLog(window.webforge.app.logFailure);

document.title = t("app.name");
// Shift+F10 opens context menus on macOS too, as it does on Windows (#287).
installMenuKeys(document);

// The start-up screen in index.html shows until this root's first render replaces it (#887).
// While developing, React's errors also show in the console, as they would without these options.
const root = createRoot(
  container,
  rootErrorOptions(reportError, import.meta.env.DEV ? showInDevConsole : undefined),
);
markFirstRender(container);
try {
  const [info, preferences, loaded, uiState] = await Promise.all([
    window.webforge.app.getInfo(),
    window.webforge.prefs.get(),
    loadSite(window.webforge.project, () => starterSite()),
    window.webforge.project.getUiState(),
  ]);
  // The theme before the first paint, so the window never flashes the other one.
  applyTheme(preferences.theme, window);

  // With a site open, the editor; otherwise the start screen (1.8), which reloads the window once
  // it has created or opened one.
  root.render(
    <StrictMode>
      {loaded.kind === "file" ? (
        <App info={info} preferences={preferences} loaded={loaded} uiState={uiState} />
      ) : (
        <StartScreen info={info} />
      )}
    </StrictMode>,
  );
} catch (error) {
  // Nothing to show without these: say so, with a way to try again, never leave the start-up
  // screen up (#887). The error becomes a crash report, as an uncaught one would.
  reportError("uncaught-error", error);
  root.render(
    <StrictMode>
      <StartFailed onRetry={() => window.location.reload()} />
    </StrictMode>,
  );
}
