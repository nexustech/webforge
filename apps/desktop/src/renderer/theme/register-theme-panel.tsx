import { t } from "@webforge/i18n";
import { PaletteIcon } from "lucide-react";
import { createStore, type StoreApi } from "zustand/vanilla";
import type { FontsApi } from "../../shared/ipc/fonts.js";
import type { EditorSession } from "../editor/editor-session.js";
import type { SiteWideConfirm } from "../shell/confirm-site-wide.js";
import type { PanelRegistry } from "../shell/panels.js";
import type { OwnThemes } from "./own-themes.js";
import { draftChanges } from "./studio/look-draft.js";
import type { StudioState } from "./studio/studio-state.js";
import { ThemePanel } from "./ThemePanel.js";

/** The Theme tab's id, which View → Theme… shows. */
export const THEME_PANEL_ID = "theme";

/**
 * Adds the Theme tab to the right column, after Site (2.3a, ADR 0008), in Simple and Advanced
 * mode. A preset, a colour or the fonts are asked about first with `siteWide` (D7), if given. With
 * `studio`, the tab has a button that opens Theme Studio (2.3b), which the window draws. With
 * `ownThemes`, it lists My themes first and keeps built-in themes read-only (2.23).
 *
 * A request to show it can name what to reveal (CT-3, the Edit panel's provenance): a field of the
 * tab, which it scrolls to and focuses, or `look:‹type›`, a kind's look, which Theme Studio's
 * Components shows. Returns a function that removes it.
 */
export function registerThemePanel(
  panels: PanelRegistry,
  session: EditorSession,
  siteWide?: Pick<SiteWideConfirm, "confirmSiteWide">,
  studio?: StoreApi<StudioState>,
  ownThemes?: OwnThemes,
  fonts?: () => FontsApi,
): () => void {
  // The field to reveal once the tab is drawn: it may be hidden when it is asked for.
  const reveal = createStore<{ readonly field?: string | undefined }>()(() => ({}));
  const stop = panels.onShow((id, target) => {
    if (id !== THEME_PANEL_ID || target === undefined) return;
    if (target.startsWith(LOOK)) {
      const kind = target.slice(LOOK.length);
      // Another kind's changes not applied yet come first (4.10): shown, with the question to
      // apply or discard them before this kind shows, as choosing it in Components asks.
      studio?.setState(({ draft }) =>
        draft !== undefined &&
        draft.type !== kind &&
        draftChanges(session.history.document.getState().theme, draft)
          ? { open: true, section: "components", kind: draft.type, pending: { kind } }
          : { open: true, section: "components", kind },
      );
    } else {
      reveal.setState({ field: target });
    }
  });
  function Theme() {
    return (
      <ThemePanel
        session={session}
        siteWide={siteWide}
        studio={studio}
        ownThemes={ownThemes}
        reveal={reveal}
        fonts={fonts}
      />
    );
  }
  const remove = panels.register({
    id: THEME_PANEL_ID,
    slot: "right.bottom",
    title: t("theme.panelTitle"),
    icon: PaletteIcon,
    component: Theme,
  });
  return () => {
    stop();
    remove();
  };
}

/** What a request to show the Theme tab starts with to show a kind's look instead (CT-3). */
const LOOK = "look:";
