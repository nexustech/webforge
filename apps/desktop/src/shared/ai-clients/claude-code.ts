import { t } from "@webforge/i18n/main";
import { CLAUDE_CODE_KEY_VARIABLE, claudeCodeCommand, claudeCodeKeyCommand } from "../mcp-setup.js";
import type { AiClient } from "./types.js";

/**
 * Claude Code (5.13, AIA-13): at the address directly, added by a command the person runs, with
 * the key in an environment variable, never in the command. Its setup is three steps, each with
 * what it copies (#1245): the command that adds it, the one that gives the terminal the key for
 * this computer's shell, with the key, and starting Claude Code in that terminal.
 */
export const claudeCode = {
  id: "claudeCode",
  verifiesServer: false,
  label: () => t("aiApps.client.claudeCode.label"),
  defaultName: () => t("aiApps.client.claudeCode.label"),
  hint: () => t("aiApps.client.claudeCode.hint"),
  setup: {
    title: () => t("aiApps.client.claudeCode.steps"),
    steps: (address, shell) => [
      {
        text: t("aiApps.client.claudeCode.step1"),
        command: {
          value: claudeCodeCommand(address),
          copyLabel: t("aiApps.client.claudeCode.copyCommand"),
        },
      },
      {
        text: t("aiApps.client.claudeCode.step2", {
          key: t(
            shell === "powershell"
              ? "aiApps.client.claudeCode.enterKey"
              : "aiApps.client.claudeCode.returnKey",
          ),
        }),
        command: {
          value: claudeCodeKeyCommand(shell),
          copyLabel: t("aiApps.client.claudeCode.copyKeyCommand"),
        },
        key: true,
      },
      { text: t("aiApps.client.claudeCode.step3") },
    ],
  },
  note: () => t("aiApps.client.claudeCode.keyWhere", { variable: CLAUDE_CODE_KEY_VARIABLE }),
} as const satisfies AiClient<"claudeCode">;
