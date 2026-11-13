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
const APP = "1c2d3e4f-5a6b-4c7d-8e9f-a0b1c2d3e4f5";

describe("VS Code's install link (5.13)", () => {
  it("names the address, and asks for the key through a password input it puts in the header", () => {
    expect(vsCodeServer(ADDRESS, APP, PROMPT)).toEqual({
      name: MCP_SERVER_NAME,
      type: "http",
      url: ADDRESS,
      // biome-ignore lint/suspicious/noTemplateCurlyInString: VS Code's input variable, which it fills.
      headers: { Authorization: "Bearer ${input:webforge-key-1c2d3e4f}" },
      inputs: [
        { type: "promptString", id: "webforge-key-1c2d3e4f", description: PROMPT, password: true },
      ],
    });
  });

  it("is VS Code's install link, carrying that entry and nothing else", () => {
    const link = vsCodeInstallLink(ADDRESS, APP, PROMPT);
    expect(link.startsWith("vscode:mcp/install?")).toBe(true);
    expect(JSON.parse(decodeURIComponent(link.slice("vscode:mcp/install?".length)))).toEqual(
      vsCodeServer(ADDRESS, APP, PROMPT),
    );
    // Encoded whole: nothing in the entry ends the link early or adds to its query.
    expect(link.slice("vscode:mcp/install?".length)).not.toMatch(/[?&#\s"{}]/);
  });

  it("asks for each pairing's key under its own input, so VS Code never sends an older one", () => {
    const other = "9f8e7d6c-5b4a-4392-8170-6f5e4d3c2b1a";
    expect(vsCodeServer(ADDRESS, other, PROMPT).inputs[0]?.id).not.toBe(
      vsCodeServer(ADDRESS, APP, PROMPT).inputs[0]?.id,
    );
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
