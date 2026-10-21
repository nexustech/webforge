import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { tempDirFactory } from "@webforge/test-utils";
import { describe, expect, it } from "vitest";
import { E2E_DIALOGS_VARIABLE, e2eDialogAnswer } from "./e2e-dialogs.js";

const tempDir = tempDirFactory("webforge-e2e-dialogs-");

function answersFile(content: string): NodeJS.ProcessEnv {
  const file = join(tempDir(), "dialogs.json");
  writeFileSync(file, content);
  return { [E2E_DIALOGS_VARIABLE]: file };
}

describe("e2eDialogAnswer", () => {
  it("leaves the dialogs alone without an answers file", () => {
    expect(e2eDialogAnswer("open", {})).toBeUndefined();
    expect(e2eDialogAnswer("open", { [E2E_DIALOGS_VARIABLE]: "" })).toBeUndefined();
  });

  it("answers each dialog from the file, and cancels the ones it leaves out", () => {
    const env = answersFile(JSON.stringify({ save: "/sites/New.wforge", open: "/sites/A.wforge" }));

    expect(e2eDialogAnswer("save", env)).toEqual({ path: "/sites/New.wforge" });
    expect(e2eDialogAnswer("open", env)).toEqual({ path: "/sites/A.wforge" });
    expect(e2eDialogAnswer("folder", env)).toEqual({ path: undefined });
  });

  it("rejects a file that isn't a set of answers", () => {
    expect(() => e2eDialogAnswer("open", answersFile('{"open":1}'))).toThrow();
    expect(() => e2eDialogAnswer("open", answersFile("not json"))).toThrow();
  });
});
