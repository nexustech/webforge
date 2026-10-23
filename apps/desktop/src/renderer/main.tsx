import { t } from "@webforge/i18n";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.js";
import { starterSite } from "./editor/starter-site.js";
import { createErrorReporter, installErrorReporting, rootErrorOptions } from "./error-reporting.js";
import { StartScreen } from "./start/StartScreen.js";
import { loadSite } from "./storage/load-site.js";
import "./styles.css";

// Bootstrap only; App is unit-tested and E2E tests cover this file.

const container = document.getElementById("root");
if (container === null) {
  throw new Error("Missing #root element in index.html");
}

// Errors become local crash reports (R3), from the first moment: names and frames, no messages.
const reportError = createErrorReporter(window.webforge.app.reportError);
installErrorReporting(window, reportError);

document.title = t("app.name");
const [info, preferences, loaded, uiState] = await Promise.all([
  window.webforge.app.getInfo(),
  window.webforge.prefs.get(),
  loadSite(window.webforge.project, () => starterSite()),
  window.webforge.project.getUiState(),
]);
// The theme before the first paint, so the window never flashes the other one.
document.documentElement.dataset.theme = preferences.theme;

// With a site open, the editor; otherwise the start screen (1.8), which reloads the window once
// it has created or opened one.
// While developing, React's errors also show in the console, as they would without these options.
createRoot(
  container,
  rootErrorOptions(reportError, import.meta.env.DEV ? (error) => console.error(error) : undefined),
).render(
  <StrictMode>
    {loaded.kind === "file" ? (
      <App info={info} preferences={preferences} loaded={loaded} uiState={uiState} />
    ) : (
      <StartScreen info={info} />
    )}
  </StrictMode>,
);
