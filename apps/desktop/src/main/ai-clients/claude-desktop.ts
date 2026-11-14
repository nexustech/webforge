import type { ClaudeExtensions } from "../claude-extension.js";
import type { ClientInstall } from "./types.js";

/**
 * Claude Desktop's install (ADR 0021): its extension, the bridge with the address and the app's
 * server proof, written and opened for Claude Desktop to install. Removed with the app.
 */
export const claudeDesktopInstall = (
  extensions: Pick<ClaudeExtensions, "install" | "remove">,
): ClientInstall => ({
  install: async (request) => (await extensions.install(request)).outcome,
  remove: (appId) => extensions.remove(appId),
});
