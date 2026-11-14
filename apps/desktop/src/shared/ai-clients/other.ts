import { t } from "@webforge/i18n";
import type { AiClient } from "./types.js";

/** Any other app that connects to an MCP server at an address, such as Cursor (4.9, ADR 0021). */
export const otherApp = {
  id: "other",
  verifiesServer: false,
  label: () => t("aiApps.client.other.label"),
  defaultName: () => "",
  hint: () => t("aiApps.client.other.hint"),
  copy: {
    label: () => t("aiApps.key.address"),
    copyLabel: () => t("aiApps.key.copyAddress"),
    value: (address) => address,
  },
  note: () => t("aiApps.key.how"),
} as const satisfies AiClient<"other">;
