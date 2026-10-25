import { t } from "@webforge/i18n";
import { COMMAND_IDS } from "../shell/command-ids.js";

/** One entry of the start screen's Help tab: the command it runs, and what it is for. */
export type HelpItem = {
  /** The command's id; the entry shows its label, and only while it is registered. */
  readonly command: string;
  readonly description: () => string;
};

/**
 * The start screen's Help tab (2.14b, LF-10): each entry a command, so the same thing runs from
 * the Help menu and the command box. Nothing here opens a web page. 5.4 adds the bundled guide
 * with one line.
 */
export const HELP_ITEMS: readonly HelpItem[] = [
  { command: COMMAND_IDS.shortcuts, description: () => t("site.start.help.shortcuts") },
  { command: COMMAND_IDS.tryExample, description: () => t("site.start.help.example") },
];
