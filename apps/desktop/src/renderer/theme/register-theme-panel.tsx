import { t } from "@webforge/i18n";
import { PaletteIcon } from "lucide-react";
import type { StoreApi } from "zustand/vanilla";
import type { EditorSession } from "../editor/editor-session.js";
import type { SiteWideConfirm } from "../shell/confirm-site-wide.js";
import type { PanelRegistry } from "../shell/panels.js";
import type { OwnThemes } from "./own-themes.js";
import type { StudioState } from "./studio/studio-state.js";
import { ThemePanel } from "./ThemePanel.js";

/** The Theme tab's id, which View → Theme… shows. */
export const THEME_PANEL_ID = "theme";

/**
 * Adds the Theme tab to the right column, after Site (2.3a, ADR 0008), in Simple and Advanced
 * mode. A preset, a colour or the fonts are asked about first with `siteWide` (D7), if given. With
 * `studio`, the tab has a button that opens Theme Studio (2.3b), which the window draws. With
 * `ownThemes`, it lists My themes first and keeps built-in themes read-only (2.22).
 * Returns a function that removes it.
 */
export function registerThemePanel(
  panels: PanelRegistry,
  session: EditorSession,
  siteWide?: Pick<SiteWideConfirm, "confirmSiteWide">,
  studio?: StoreApi<StudioState>,
  ownThemes?: OwnThemes,
): () => void {
  function Theme() {
    return (
      <ThemePanel session={session} siteWide={siteWide} studio={studio} ownThemes={ownThemes} />
    );
  }
  return panels.register({
    id: THEME_PANEL_ID,
    slot: "right.bottom",
    title: t("theme.panelTitle"),
    icon: PaletteIcon,
    component: Theme,
  });
}
