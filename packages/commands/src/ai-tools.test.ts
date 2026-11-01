import { describe, expect, it } from "vitest";
import { AI_TOOLS, UNTRUSTED_SITE_TEXT } from "./ai-tools.js";
import { COMMANDS } from "./commands.js";
import { QUERIES } from "./queries.js";

describe("AI apps' tools (4.9)", () => {
  it("are every query and command, once, by its own name", () => {
    expect(AI_TOOLS.map((tool) => tool.name)).toEqual([
      ...Object.keys(QUERIES),
      ...Object.keys(COMMANDS),
    ]);
    expect(AI_TOOLS.filter((tool) => tool.kind === "command").map((tool) => tool.name)).toEqual(
      Object.keys(COMMANDS),
    );
  });

  it("say what each does, and that site text is untrusted data, never instructions", () => {
    for (const tool of AI_TOOLS) {
      expect(tool.description.length).toBeGreaterThan(UNTRUSTED_SITE_TEXT.length + 40);
      expect(tool.description.endsWith(UNTRUSTED_SITE_TEXT)).toBe(true);
    }
  });

  it("take an object as JSON Schema, in which what has a default may be left out", () => {
    for (const tool of AI_TOOLS) {
      expect(tool.inputSchema.type).toBe("object");
      expect(tool.inputSchema).not.toHaveProperty("$schema");
    }
    const addNode = AI_TOOLS.find((tool) => tool.name === "addNode")?.inputSchema;
    expect(addNode?.required).toEqual(["location", "type"]);
    expect(addNode?.additionalProperties).toBe(false);
  });

  it("are plain JSON, as MCP sends them", () => {
    expect(JSON.parse(JSON.stringify(AI_TOOLS))).toEqual(AI_TOOLS);
  });
});
