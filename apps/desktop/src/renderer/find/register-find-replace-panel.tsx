import { t } from "@webforge/i18n";
import { ReplaceIcon } from "lucide-react";
import { useMemo } from "react";
import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";
import { reportFailure } from "../log.js";
import { COMMAND_IDS } from "../shell/command-ids.js";
import type { CommandRegistry } from "../shell/commands.js";
import type { PanelRegistry } from "../shell/panels.js";
import {
  type FindGroup,
  FindReplacePanel,
  type FindReplacePanelProps,
  type FindRow,
  type FindState,
} from "./FindReplacePanel.js";
import {
  type FindActions,
  groupName,
  replaceAll,
  replaceOne,
  showSpot,
  spotName,
} from "./find-actions.js";
import { findInSite, groupOf, type TextSpot } from "./find-text.js";

/** Find and Replace's panel id. */
export const FIND_REPLACE_PANEL_ID = "findReplace";

/** What the panel works on: the site, where a match is shown, and the site-wide question. */
export type FindReplaceOptions = FindActions & {
  readonly panels: PanelRegistry;
  readonly commands: CommandRegistry;
};

/**
 * Puts Find and Replace (6.2) in the bottom drawer, beside Site Check, and Edit › Find and
 * Replace… (Ctrl+F, Cmd+F on a Mac), which shows it with the cursor in *Find*. What was typed is
 * kept while the window is open. Returns a function that removes them.
 */
export function registerFindReplacePanel(options: FindReplaceOptions): () => void {
  const { session, panels, commands } = options;
  const state = createStore<FindState & { readonly focusRequest: number }>(() => ({
    query: "",
    replacement: "",
    matchCase: false,
    wholeWords: false,
    focusRequest: 0,
  }));

  function FindReplace() {
    const values = useStore(state);
    const site = useStore(session.history.document);
    const { query, replacement, matchCase, wholeWords } = values;
    const found = useMemo(
      () => findInSite(site, session.library, { query, matchCase, wholeWords }),
      [site, query, matchCase, wholeWords],
    );
    // Each row knows its spot and which of the spot's matches it is.
    const { groups, rows } = useMemo(() => {
      const byKey = new Map<string, { spot: TextSpot; occurrence: number }>();
      const list: { key: string; name: string; rows: FindRow[] }[] = [];
      for (const { spot, matches } of found) {
        const group = groupOf(spot);
        let entry = list.at(-1);
        if (entry?.key !== group) {
          entry = { key: group, name: groupName(site, group), rows: [] };
          list.push(entry);
        }
        const where = spotName(site, session.library, spot);
        for (const [occurrence, match] of matches.entries()) {
          const key = `${JSON.stringify(spot)}#${occurrence}`;
          byKey.set(key, { spot, occurrence });
          entry.rows.push({ key, where, ...match });
        }
      }
      const groups: readonly FindGroup[] = list;
      return { groups, rows: byKey };
    }, [found, site]);
    const find = { query, matchCase, wholeWords };
    const props: FindReplacePanelProps = {
      state: values,
      onChange: (change) => state.setState(change),
      groups,
      focusRequest: values.focusRequest,
      onShow: (row) => {
        const at = rows.get(row.key);
        if (at !== undefined) showSpot(at.spot, options);
      },
      onReplace: (row) => {
        const at = rows.get(row.key);
        if (at !== undefined) replaceOne(session, find, replacement, at.spot, at.occurrence);
      },
      onReplaceAll: () => {
        replaceAll(options, find, replacement).catch((error: unknown) =>
          reportFailure("findReplace.replaceAll", error),
        );
      },
    };
    return <FindReplacePanel {...props} />;
  }

  const removePanel = panels.register({
    id: FIND_REPLACE_PANEL_ID,
    slot: "drawer",
    title: t("findReplace.panelTitle"),
    icon: ReplaceIcon,
    component: FindReplace,
  });
  const removeCommand = commands.register({
    id: COMMAND_IDS.findReplace,
    label: t("findReplace.command"),
    menu: "edit",
    keywords: [t("findReplace.find"), t("findReplace.replaceAll")],
    run: () => {
      panels.show(FIND_REPLACE_PANEL_ID);
      state.setState((current) => ({ focusRequest: current.focusRequest + 1 }));
    },
  });
  return () => {
    removeCommand();
    removePanel();
  };
}
