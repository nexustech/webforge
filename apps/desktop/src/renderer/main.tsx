import { installMenuKeys } from "@webforge/engine";
import { t } from "@webforge/i18n";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.js";
import { starterSite } from "./editor/starter-site.js";
import { StartScreen } from "./start/StartScreen.js";
import { loadSite } from "./storage/load-site.js";
import "./styles.css";

// Bootstrap only; App is unit-tested and E2E tests cover this file.

const container = document.getElementById("root");
if (container === null) {
  throw new Error("Missing #root element in index.html");
}

document.title = t("app.name");
// Shift+F10 opens context menus on macOS too, as it does on Windows (#287).
installMenuKeys(document);
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
createRoot(container).render(
  <StrictMode>
    {loaded.kind === "file" ? (
      <App info={info} preferences={preferences} loaded={loaded} uiState={uiState} />
    ) : (
      <StartScreen info={info} />
    )}
  </StrictMode>,
);
