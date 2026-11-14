import { t } from "@webforge/i18n";
import type { AiClient } from "./types.js";

/**
 * VS Code, for GitHub Copilot (5.13, AIA-13): at the address directly, added through its install
 * link, which main opens (`main/ai-clients/vscode.ts`). VS Code asks for the key, and keeps it.
 */
export const vsCode = {
  id: "vscode",
  verifiesServer: false,
  label: () => t("aiApps.client.vscode.label"),
  defaultName: () => t("aiApps.client.vscode.name"),
  hint: () => t("aiApps.client.vscode.hint"),
  steps: {
    title: () => t("aiApps.client.vscode.steps"),
    items: () => [
      t("aiApps.client.vscode.step1"),
      t("aiApps.client.vscode.step2"),
      t("aiApps.client.vscode.step3"),
    ],
  },
  install: {
    label: () => t("aiApps.client.vscode.install"),
    said: (status, name) =>
      status === "opened" || status === "shown"
        ? t("aiApps.client.vscode.opened")
        : status === "off"
          ? t("aiApps.add.failed.off")
          : status === "unknown"
            ? t("aiApps.client.vscode.unknown", { name })
            : t("aiApps.client.vscode.failed"),
  },
} as const satisfies AiClient<"vscode">;
