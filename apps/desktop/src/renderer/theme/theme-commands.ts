import { t } from "@webforge/i18n";
import type { StoreApi } from "zustand/vanilla";
import type { CommandRegistry } from "../shell/commands.js";
import type { PanelRegistry } from "../shell/panels.js";
import { THEME_PANEL_ID } from "./register-theme-panel.js";
import type { StudioState } from "./studio/studio-state.js";

/**
 * View → Theme… (#452), which shows the Theme tab, opening the right column if it's closed, so the
 * site's theme is found from the menu bar, the command box and the shortcut sheet too; and View →
 * Theme Studio… (2.3b), which opens Theme Studio, drawn by the window whatever the panels show.
 * Returns a function that removes them.
 */
export function registerThemeCommands(
  commands: CommandRegistry,
  panels: PanelRegistry,
  studio: StoreApi<StudioState>,
): () => void {
  const removeShow = commands.register({
    id: "theme.show",
    label: t("theme.show"),
    menu: "view",
    run: () => panels.show(THEME_PANEL_ID),
  });
  const removeStudio = commands.register({
    id: "theme.studio",
    label: t("theme.studio.command"),
    menu: "view",
    run: () => studio.setState({ open: true }),
  });
  return () => {
    removeStudio();
    removeShow();
  };
}
