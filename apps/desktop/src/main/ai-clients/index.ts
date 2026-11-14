import { claudeDesktop } from "../../shared/ai-clients/claude-desktop.js";
import { vsCode } from "../../shared/ai-clients/vscode.js";
import type { ClaudeExtensions } from "../claude-extension.js";
import { claudeDesktopInstall } from "./claude-desktop.js";
import type { ClientInstalls } from "./types.js";
import { vsCodeInstall } from "./vscode.js";

export type { ClientInstalls } from "./types.js";

/** The installs, over Claude Desktop's extensions and the browser's `openExternal`. */
export function clientInstalls(options: {
  readonly extensions: Pick<ClaudeExtensions, "install" | "remove">;
  readonly openExternal: (url: string) => Promise<void>;
}): ClientInstalls {
  return {
    [claudeDesktop.id]: claudeDesktopInstall(options.extensions),
    [vsCode.id]: vsCodeInstall(options.openExternal),
  };
}
