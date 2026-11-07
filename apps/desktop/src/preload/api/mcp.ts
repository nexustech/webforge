import type { McpApi } from "../../shared/ipc/mcp.js";
import type { Call } from "./call.js";

/** `window.webforge.mcp`. */
export const mcpApi = (call: Call): McpApi => ({
  status: () => call("mcpStatus"),
  setEnabled: (enabled) => call("mcpSetEnabled", enabled),
  add: (name) => call("mcpAdd", name),
  remove: (id) => call("mcpRemove", id),
});
