/**
 * The quickest setup of the developer tools that *Add AI app* names (5.13, AIA-13): VS Code's
 * install link and Claude Code's command. Both connect directly (ADR 0021, decision 4), and
 * neither carries the key: VS Code asks for it, and Claude Code reads it from the environment.
 */
/** The name each tool lists Webforge's server under. */
export declare const MCP_SERVER_NAME = "webforge";
/** The environment variable Claude Code reads the key from when it connects. */
export declare const CLAUDE_CODE_KEY_VARIABLE = "WEBFORGE_KEY";
/**
 * VS Code's server entry for the app paired as `appId` at `address`, as its `vscode:mcp/install`
 * link takes it: the server's fields beside its name, and a password input that the
 * `Authorization` header names. VS Code asks for the key when the server first starts, masked, and
 * keeps it in its own secret storage. `prompt` is what it asks with.
 */
export declare const vsCodeServer: (
  address: string,
  appId: string,
  prompt: string,
) => {
  name: string;
  type: string;
  url: string;
  headers: {
    Authorization: string;
  };
  inputs: {
    type: string;
    id: string;
    description: string;
    password: boolean;
  }[];
};
/** The link that opens {@link vsCodeServer} in VS Code, to install. */
export declare const vsCodeInstallLink: (address: string, appId: string, prompt: string) => string;
/**
 * The command that adds Webforge's server at `address` to Claude Code, for every project (`user`
 * scope). The header names {@link CLAUDE_CODE_KEY_VARIABLE}, in single quotes so the shell (Bash,
 * Zsh or PowerShell) leaves it alone: Claude Code expands it as it connects, so the key is in
 * neither the shell's history nor Claude Code's settings.
 */
export declare const claudeCodeCommand: (address: string) => string;
/** The shell a terminal on the computer Webforge runs on is, for a command made for it (#1245). */
export type ShellKind = "posix" | "powershell";
/** The shell of a terminal on the computer whose browser says `userAgent`: Windows', or a Unix one. */
export declare const shellOf: (userAgent: string) => ShellKind;
/**
 * The command that gives a terminal Claude Code's key in {@link CLAUDE_CODE_KEY_VARIABLE} (#1245),
 * for `shell`: it waits for the key to be pasted and doesn't show it, so the key is never on a
 * command line or in the shell's history. It lasts as long as that terminal.
 */
export declare const claudeCodeKeyCommand: (shell: ShellKind) => string;
//# sourceMappingURL=mcp-setup.d.ts.map
