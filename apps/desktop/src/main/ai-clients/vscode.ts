import { t } from "@webforge/i18n";
import { vsCodeInstallLink } from "../../shared/mcp-setup.js";
import type { ClientInstall } from "./types.js";

/**
 * VS Code's install (5.13, AIA-13): its link to add Webforge's server, made from the address, with
 * an input VS Code asks the key with, never the key. It throws when nothing opens `vscode:` links.
 */
export const vsCodeInstall = (openExternal: (url: string) => Promise<void>): ClientInstall => ({
  install: async ({ address, appId }) => {
    await openExternal(vsCodeInstallLink(address, appId, t("aiApps.client.vscode.prompt")));
    return "opened";
  },
});
