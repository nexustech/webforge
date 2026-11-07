import { t } from "@webforge/i18n";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { helpTargetSchema, helpThemeSchema } from "../../shared/ipc/help.js";
import "../styles.css";
import { HelpWindow } from "./HelpWindow.js";
import { bundledHelpLibrary } from "./help-library.js";

// The Help window's page (5.4b, HP-10). Bootstrap only: HelpWindow is unit-tested, and the E2E
// tests cover this file.

const container = document.getElementById("root");
const api = window.webforgeHelp;
if (container === null || api === undefined) {
  throw new Error("The Help page needs #root and its preload's API");
}

// Where to start, and the editor's look, come with the page's address: no wait for a message.
const query = new URLSearchParams(window.location.search);
const start = helpTargetSchema.safeParse({
  page: query.get("page") ?? undefined,
  anchor: query.get("anchor") ?? undefined,
});
const theme = helpThemeSchema.safeParse(query.get("theme"));
document.documentElement.dataset.theme = theme.success ? theme.data : "dark";
api.onTheme((next) => {
  document.documentElement.dataset.theme = next;
});
document.title = t("help.window.title");

createRoot(container).render(
  <StrictMode>
    <HelpWindow
      library={bundledHelpLibrary()}
      start={start.success ? start.data : {}}
      openExternal={api.openExternal}
      onShow={api.onShow}
    />
  </StrictMode>,
);
