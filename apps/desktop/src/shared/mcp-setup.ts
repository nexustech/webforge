/**
 * The quickest setup of the developer tools that *Add AI app* names (5.13, AIA-13): VS Code's
 * install link and Claude Code's command. Both connect directly (ADR 0021, decision 4), and
 * neither carries the key: VS Code asks for it, and Claude Code reads it from the environment.
 */

/** The name each tool lists Webforge's server under. */
export const MCP_SERVER_NAME = "webforge";

/** The environment variable Claude Code reads the key from when it connects. */
export const CLAUDE_CODE_KEY_VARIABLE = "WEBFORGE_KEY";

/** The id of VS Code's input that asks for the key. */
const VS_CODE_KEY_INPUT = "webforge-key";

/**
 * VS Code's server entry for `address`, as its `vscode:mcp/install` link takes it: the server's
 * fields beside its name, and a password input that the `Authorization` header names. VS Code asks
 * for the key when the server first starts, masked, and keeps it in its own secret storage.
 * `prompt` is what it asks with.
 */
export const vsCodeServer = (address: string, prompt: string) => ({
  name: MCP_SERVER_NAME,
  type: "http",
  url: address,
  headers: { Authorization: `Bearer \${input:${VS_CODE_KEY_INPUT}}` },
  inputs: [{ type: "promptString", id: VS_CODE_KEY_INPUT, description: prompt, password: true }],
});

/** The link that opens {@link vsCodeServer} in VS Code, to install. */
export const vsCodeInstallLink = (address: string, prompt: string): string =>
  `vscode:mcp/install?${encodeURIComponent(JSON.stringify(vsCodeServer(address, prompt)))}`;

/**
 * The command that adds Webforge's server at `address` to Claude Code, for every project (`user`
 * scope). The header names {@link CLAUDE_CODE_KEY_VARIABLE}, in single quotes so the shell (Bash,
 * Zsh or PowerShell) leaves it alone: Claude Code expands it as it connects, so the key is in
 * neither the shell's history nor Claude Code's settings.
 */
export const claudeCodeCommand = (address: string): string =>
  `claude mcp add --transport http --scope user ${MCP_SERVER_NAME} ${address} --header 'Authorization: Bearer \${${CLAUDE_CODE_KEY_VARIABLE}}'`;
