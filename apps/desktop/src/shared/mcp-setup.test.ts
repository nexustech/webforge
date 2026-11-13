import { describe, expect, it } from "vitest";
import {
  CLAUDE_CODE_KEY_VARIABLE,
  claudeCodeCommand,
  MCP_SERVER_NAME,
  vsCodeInstallLink,
  vsCodeServer,
} from "./mcp-setup.js";

const ADDRESS = "http://127.0.0.1:51234/mcp";
const PROMPT = "The key Webforge showed when you added VS Code in AI apps";

describe("VS Code's install link (5.13)", () => {
  it("names the address, and asks for the key through a password input it puts in the header", () => {
    expect(vsCodeServer(ADDRESS, PROMPT)).toEqual({
      name: MCP_SERVER_NAME,
      type: "http",
      url: ADDRESS,
      // biome-ignore lint/suspicious/noTemplateCurlyInString: VS Code's input variable, which it fills.
      headers: { Authorization: "Bearer ${input:webforge-key}" },
      inputs: [{ type: "promptString", id: "webforge-key", description: PROMPT, password: true }],
    });
  });

  it("is VS Code's install link, carrying that entry and nothing else", () => {
    const link = vsCodeInstallLink(ADDRESS, PROMPT);
    expect(link.startsWith("vscode:mcp/install?")).toBe(true);
    expect(JSON.parse(decodeURIComponent(link.slice("vscode:mcp/install?".length)))).toEqual(
      vsCodeServer(ADDRESS, PROMPT),
    );
    // Encoded whole: nothing in the entry ends the link early or adds to its query.
    expect(link.slice("vscode:mcp/install?".length)).not.toMatch(/[?&#\s"{}]/);
  });
});

describe("Claude Code's command (5.13)", () => {
  it("adds the server at the address for every project, with the key's variable, not the key", () => {
    expect(claudeCodeCommand(ADDRESS)).toBe(
      `claude mcp add --transport http --scope user webforge ${ADDRESS} --header 'Authorization: Bearer \${${CLAUDE_CODE_KEY_VARIABLE}}'`,
    );
  });

  it("keeps the variable in single quotes, so the shell leaves it for Claude Code to expand", () => {
    const command = claudeCodeCommand(ADDRESS);
    const quoted = command.slice(command.indexOf("'"));
    expect(quoted).toBe(`'Authorization: Bearer \${${CLAUDE_CODE_KEY_VARIABLE}}'`);
    expect(command.split("'")).toHaveLength(3);
  });
});
