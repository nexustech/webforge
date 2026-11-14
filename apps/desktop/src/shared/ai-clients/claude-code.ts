import { t } from "@webforge/i18n";
import { CLAUDE_CODE_KEY_VARIABLE, claudeCodeCommand } from "../mcp-setup.js";
import type { AiClient } from "./types.js";

/**
 * Claude Code (5.13, AIA-13): at the address directly, added by a command the person runs, with
 * the key in an environment variable, never in the command.
 */
export const claudeCode = {
  id: "claudeCode",
  verifiesServer: false,
  label: () => t("aiApps.client.claudeCode.label"),
  defaultName: () => t("aiApps.client.claudeCode.label"),
  hint: () => t("aiApps.client.claudeCode.hint"),
  steps: {
    title: () => t("aiApps.client.claudeCode.steps"),
    items: () => [
      t("aiApps.client.claudeCode.step1"),
      t("aiApps.client.claudeCode.step2", { variable: CLAUDE_CODE_KEY_VARIABLE }),
    ],
  },
  copy: {
    label: () => t("aiApps.client.claudeCode.command"),
    copyLabel: () => t("aiApps.client.claudeCode.copyCommand"),
    value: claudeCodeCommand,
  },
  note: () => t("aiApps.client.claudeCode.keyWhere", { variable: CLAUDE_CODE_KEY_VARIABLE }),
} as const satisfies AiClient<"claudeCode">;
