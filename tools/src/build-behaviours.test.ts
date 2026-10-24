import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { behavioursModule, readBehaviours } from "./build-behaviours.js";

describe("the behaviours module (R7)", () => {
  it("holds each behaviour's text by name, in name order, as plain string constants", () => {
    const module = behavioursModule({ tabs: 'say("tabs");\n', menu: "(() => {})();\n" });

    expect(module).toContain('export type BehaviourName = "menu" | "tabs";');
    expect(module).toContain(
      [
        "export const BEHAVIOUR_FILES: Readonly<Record<BehaviourName, string>> = {",
        '  "menu": "(() => {})();\\n",',
        '  "tabs": "say(\\"tabs\\");\\n",',
        "};",
      ].join("\n"),
    );
    expect(module).toContain("don't edit it by hand");
  });

  it("names no behaviour when there are none", () => {
    expect(behavioursModule({})).toContain("export type BehaviourName = never;");
  });

  it("reads the .js files of a folder, by name without .js", () => {
    const folder = mkdtempSync(join(tmpdir(), "webforge-behaviours-"));
    try {
      writeFileSync(join(folder, "menu.js"), "menu();\n");
      writeFileSync(join(folder, "index.ts"), "export {};\n");

      expect(readBehaviours(folder)).toEqual({ menu: "menu();\n" });
    } finally {
      rmSync(folder, { recursive: true, force: true });
    }
  });
});
