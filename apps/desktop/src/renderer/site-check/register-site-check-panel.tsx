import { t } from "@webforge/i18n";
import { ListChecksIcon } from "lucide-react";
import { useStore } from "zustand";
import type { EditorSession } from "../editor/editor-session.js";
import type { SettingsRegistry } from "../editor/settings-registry.js";
import type { PanelRegistry } from "../shell/panels.js";
import { fixFor, jumpTo } from "./actions.js";
import type { BundleActions } from "./bundle.js";
import { describeDetail, describePlace } from "./describe.js";
import { SiteCheckPanel } from "./SiteCheckPanel.js";
import { createSiteCheck } from "./site-check-store.js";

/** Site Check's panel id: the export shows it when something must be fixed first (X5). */
export const SITE_CHECK_PANEL_ID = "siteCheck";

/** What the panel works on, and where it remembers what is ignored. */
type SiteCheckPanelOptions = {
  readonly session: EditorSession;
  readonly settings: SettingsRegistry;
  /** What the person ignored for the open site, as main loaded it. */
  readonly ignored: readonly string[];
  /** Remembers what is ignored with the open site. */
  readonly saveIgnored: (ignored: readonly string[]) => void;
  /** Download and bundle (3.9): its *Fix* for a file from another website. */
  readonly bundle?: BundleActions;
};

/**
 * Puts Site Check in the bottom drawer (F-CHK-1, UI1), in Simple and Advanced mode (T2). It checks
 * the site in the background as it changes; a finding jumps to where it is, and some have a *Fix*.
 * Returns a function that removes the panel and stops checking.
 */
export function registerSiteCheckPanel(
  panels: PanelRegistry,
  { session, settings, ignored, saveIgnored, bundle }: SiteCheckPanelOptions,
): () => void {
  const siteCheck = createSiteCheck(session.history.document, { ignored, saveIgnored });
  const actions = { session, panels, settings, ...(bundle === undefined ? {} : { bundle }) };

  function SiteCheck() {
    const report = useStore(siteCheck.state, (state) => state.report);
    const site = session.history.document.getState();
    return (
      <SiteCheckPanel
        report={report}
        ignored={report.results.reduce((count, result) => count + result.ignored, 0)}
        describe={(finding) => ({
          place: describePlace(finding, site, session.library),
          detail: describeDetail(finding),
        })}
        fixFor={(rule, finding) => fixFor(rule, finding, actions)}
        onJump={(finding) => jumpTo(finding.place, actions)}
        onIgnore={(rule, finding) => siteCheck.ignore(rule, finding.key)}
        onRestore={() => siteCheck.restoreIgnored()}
      />
    );
  }

  const remove = panels.register({
    id: SITE_CHECK_PANEL_ID,
    slot: "drawer",
    title: t("siteCheck.title"),
    icon: ListChecksIcon,
    component: SiteCheck,
  });
  return () => {
    remove();
    siteCheck.dispose();
  };
}
