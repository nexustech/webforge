import { t } from "@webforge/i18n";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.js";
import { starterSite } from "./editor/starter-site.js";
import { loadSite } from "./storage/load-site.js";
import "./styles.css";

// Bootstrap only; App is unit-tested and E2E tests cover this file.

const container = document.getElementById("root");
if (container === null) {
  throw new Error("Missing #root element in index.html");
}

document.title = t("app.name");
const info = await window.webforge.app.getInfo();
const loaded = await loadSite(window.webforge.project, () => starterSite());

createRoot(container).render(
  <StrictMode>
    <App info={info} loaded={loaded} />
  </StrictMode>,
);
