import type { McpApi } from "../../shared/ipc/mcp.js";
import type { Call } from "./call.js";

/** `window.webforge.mcp`. */
export const mcpApi = (call: Call): McpApi => ({
  status: () => call("mcpStatus"),
  setEnabled: (enabled) => call("mcpSetEnabled", enabled),
  add: (name, kind) => call("mcpAdd", name, kind),
  seenMoved: async () => {
    await call("mcpSeenMoved");
  },
  installClaude: (id) => call("mcpInstallClaude", id),
  remove: (id) => call("mcpRemove", id),
});
