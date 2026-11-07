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

 * the Help menu and the command box. Nothing here opens a web page: the help pages come with the
 * app, and open in the Help window (5.4b).
 */
export const HELP_ITEMS: readonly HelpItem[] = [
  {
    command: "help.page.getting-started",
    description: () => t("site.start.help.gettingStarted"),
  },
  { command: "help.page.the-editor", description: () => t("site.start.help.editor") },
  {
    command: "help.page.keyboard-shortcuts",
    description: () => t("site.start.help.shortcutsPage"),
  },
  { command: COMMAND_IDS.shortcuts, description: () => t("site.start.help.shortcuts") },
  { command: COMMAND_IDS.tryExample, description: () => t("site.start.help.example") },
];
