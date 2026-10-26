import { t } from "@webforge/i18n";
import type { CommandRegistry } from "../shell/commands.js";
import type { PanelRegistry } from "../shell/panels.js";
import { THEME_PANEL_ID } from "./register-theme-panel.js";

/**
 * View → Theme… (#452): shows the Theme tab, opening the right column if it's closed, so the site's
 * theme is found from the menu bar, the command box and the shortcut sheet too. Returns a function
 * that removes it.
 */
export function registerThemeCommands(
  commands: CommandRegistry,
  panels: PanelRegistry,
): () => void {
  return commands.register({
    id: "theme.show",
    label: t("theme.show"),
    menu: "view",
    run: () => panels.show(THEME_PANEL_ID),
  });
}
