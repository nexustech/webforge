import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import {
  AI_CLIENT_IDS,
  AI_CLIENTS,
  clientOf,
  DEFAULT_CLIENT,
} from "../../shared/ai-clients/index.js";
import { clientInstalls } from "./index.js";

const SOURCE = join(import.meta.dirname, "../..");

/** Every TypeScript file of the desktop app, leaving out tests and stories. */
function sources(): string[] {
  return readdirSync(SOURCE, { recursive: true, encoding: "utf8" })
    .filter((file) => /\.tsx?$/.test(file) && !/\.(test|stories)\.tsx?$/.test(file))
    .map((file) => join(SOURCE, file));
}

describe("the AI client registry (#980)", () => {
  it("lists each kind once, each with its words, and the default among them", () => {
    expect(new Set(AI_CLIENT_IDS).size).toBe(AI_CLIENTS.length);
    expect(AI_CLIENTS.map((client) => client.id)).toEqual([...AI_CLIENT_IDS]);
    expect(AI_CLIENT_IDS).toContain(DEFAULT_CLIENT);
    for (const client of AI_CLIENTS) {
      expect(client.label(), client.id).not.toBe("");
      expect(client.hint(), client.id).not.toBe("");
      for (const step of client.steps?.items() ?? []) expect(step, client.id).not.toBe("");
    }
  });

  it("checks the server only through Claude Desktop's extension; an app with no kind is generic", () => {
    expect(AI_CLIENTS.filter((client) => client.verifiesServer).map((client) => client.id)).toEqual(
      ["claude"],
    );
    expect(clientOf(undefined).verifiesServer).toBe(false);
    expect(clientOf(undefined).copy?.value("http://127.0.0.1:1/mcp")).toBe(
      "http://127.0.0.1:1/mcp",
    );
  });

  it("installs in main exactly the kinds whose dialog offers an install", () => {
    const installs = clientInstalls({
      extensions: {
        install: async () => ({ file: "", outcome: "opened" }),
        remove: async () => undefined,
      },
      openExternal: async () => undefined,
    });
    expect(Object.keys(installs).sort()).toEqual(
      AI_CLIENTS.filter((client) => client.install !== undefined)
        .map((client) => client.id)
        .sort(),
    );
  });

  it('names Claude Desktop\'s kind in its own module only: no "claude" in code anywhere else', () => {
    const named = sources()
      .filter((file) => readFileSync(file, "utf8").includes('"claude"'))
      .map((file) => relative(SOURCE, file).replaceAll("\\", "/"));
    expect(named).toEqual(["shared/ai-clients/claude-desktop.ts"]);
  });
});
