// Where AI apps reach the MCP server (4.9): apart from the listener, so Settings can say so
// without loading the MCP SDK at start-up (#892).

/** The one address AI apps reach: the literal loopback address, never a name (ADR 0021). */
export const MCP_HOST = "127.0.0.1";

/** The one path the server answers. */
export const MCP_PATH = "/mcp";
