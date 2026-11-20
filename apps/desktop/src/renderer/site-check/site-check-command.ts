import type { ReadonlyStore } from "@webforge/history";
import { plural, t } from "@webforge/i18n";
import type { CheckReport } from "@webforge/site-check";
import { COMMAND_IDS } from "../shell/command-ids.js";
import type { CommandRegistry } from "../shell/commands.js";
import type { PanelRegistry } from "../shell/panels.js";
import { countsByLevel } from "./counts.js";

/**
 * What the title bar's Site Check button says (#1009): "5 to fix · 13 tips", *Must fix* and
 * *Should fix* counted together, either left out at none, or "No problems" with nothing at all.
 */
export function siteCheckStatus(report: CheckReport): string {
  const counts = countsByLevel(report);
  const toFix = counts.must + counts.should;
  const tips = counts.tip;
  const parts = [
    ...(toFix === 0 ? [] : [plural("siteCheck.button.toFix", toFix)]),
    ...(tips === 0 ? [] : [plural("siteCheck.count.tip", tips)]),
  ];
  return parts.length === 0 ? t("siteCheck.button.clear") : parts.join(" · ");
}

/**
 * Site Check's command (#1009), which opens its panel: the title bar's button, showing what the
 * latest check found as it changes, and Site › Site Check (#1165). Returns a function that removes it.
 */
export function registerSiteCheckCommand(
  commands: Pick<CommandRegistry, "register" | "update">,
  panels: Pick<PanelRegistry, "show">,
  panelId: string,
  state: ReadonlyStore<{ readonly report: CheckReport }>,
): () => void {
  const remove = commands.register({
    id: COMMAND_IDS.siteCheck,
    label: t("siteCheck.title"),
    // Site › Site Check too (#1165), beside Version History.
    menu: "site",
    status: siteCheckStatus(state.getState().report),
    run: () => panels.show(panelId),
  });
  const stop = state.subscribe(({ report }, before) => {
    if (report !== before.report) {
      commands.update(COMMAND_IDS.siteCheck, { status: siteCheckStatus(report) });
    }
  });
  return () => {
    stop();
    remove();
  };
}
