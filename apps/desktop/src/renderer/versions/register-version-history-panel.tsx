import { t } from "@webforge/i18n";
import { ArchiveRestoreIcon } from "lucide-react";
import { useEffect } from "react";
import { useStore } from "zustand";
import type { PanelRegistry } from "../shell/panels.js";
import { VersionHistoryPanel } from "./VersionHistoryPanel.js";
import type { VersionActions } from "./version-actions.js";
import type { VersionList } from "./version-list.js";

/**
 * Adds Version History beside Undo History in the left column's bottom (A21), listing the site's
 * versions each time it's shown. Returns a function that removes it.
 */
export function registerVersionHistoryPanel(
  panels: PanelRegistry,
  list: VersionList,
  actions: Pick<VersionActions, "restore" | "remove" | "openAsNewSite" | "cleanUp">,
  onSave: () => void,
): () => void {
  function VersionHistory() {
    const state = useStore(list.state);
    // Again each time it's shown: the daily version is saved by main, with the day's first change.
    useEffect(() => {
      void list.refresh();
    }, []);
    return <VersionHistoryPanel state={state} actions={actions} onSave={onSave} />;
  }
  return panels.register({
    id: "versionHistory",
    slot: "left.bottom",
    title: t("versionHistory.panelTitle"),
    icon: ArchiveRestoreIcon,
    component: VersionHistory,
  });
}
