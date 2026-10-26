import { t } from "@webforge/i18n";
import { PaletteIcon } from "lucide-react";
import type { EditorSession } from "../editor/editor-session.js";
import type { SiteWideConfirm } from "../shell/confirm-site-wide.js";
import type { PanelRegistry } from "../shell/panels.js";
import { ThemePanel } from "./ThemePanel.js";

/**
 * Adds the Theme tab to the right column, after Site (2.3a, ADR 0008), in Simple and Advanced
 * mode. A preset, a colour or the fonts are asked about first with `siteWide` (D7), if given.
 * Returns a function that removes it.
 */
export function registerThemePanel(
  panels: PanelRegistry,
  session: EditorSession,
  siteWide?: Pick<SiteWideConfirm, "confirmSiteWide">,
): () => void {
  function Theme() {
    return <ThemePanel session={session} siteWide={siteWide} />;
  }
  return panels.register({
    id: "theme",
    slot: "right.bottom",
    title: t("theme.panelTitle"),
    icon: PaletteIcon,
    component: Theme,
  });
}
