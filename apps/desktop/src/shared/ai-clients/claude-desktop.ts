import { t } from "@webforge/i18n";
import type { AiClient } from "./types.js";

/**
 * Claude Desktop (4.9): through Webforge's extension, which Claude Desktop installs and which
 * checks it's Webforge it talks to before it sends the key (ADR 0021). Main writes the extension
 * (`main/ai-clients/claude-desktop.ts`).
 */
export const claudeDesktop = {
  id: "claude",
  verifiesServer: true,
  label: () => t("aiApps.client.claude.label"),
  defaultName: () => t("aiApps.client.claude.label"),
  hint: () => t("aiApps.client.claude.hint"),
  steps: {
    title: () => t("aiApps.client.claude.steps"),
    items: () => [
      t("aiApps.client.claude.step1"),
      t("aiApps.client.claude.step2"),
      t("aiApps.client.claude.step3"),
    ],
  },
  install: {
    label: () => t("aiApps.client.claude.install"),
    said: (status, name) =>
      status === "opened"
        ? t("aiApps.client.claude.opened")
        : status === "shown"
          ? t("aiApps.client.claude.shown")
          : status === "off"
            ? t("aiApps.add.failed.off")
            : status === "unknown"
              ? t("aiApps.client.claude.unknown", { name })
              : t("aiApps.client.claude.failed"),
  },
} as const satisfies AiClient<"claude">;
