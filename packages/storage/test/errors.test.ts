import { WebforgeError } from "@webforge/errors";
import { describe, expect, it } from "vitest";
import { ProjectFileError, ReadOnlyProjectError } from "../src/errors.js";

describe("storage's errors (R12)", () => {
  it("are Webforge errors with the message each code shows", () => {
    const cases = [
      ["not-found", "site.openFailed.missing"],
      ["not-a-project", "site.openFailed.notASite"],
      ["corrupt", "site.openFailed.damaged"],
      ["unexpected-schema", "site.openFailed.notASite"],
      ["newer-format", "site.openFailed.newer"],
    ] as const;

    for (const [code, messageKey] of cases) {
      const error = new ProjectFileError(code, "for developers");
      expect(error).toBeInstanceOf(WebforgeError);
      expect(error).toMatchObject({ name: "ProjectFileError", code, messageKey });
    }
    expect(new ReadOnlyProjectError()).toMatchObject({
      name: "ReadOnlyProjectError",
      code: "read-only",
      messageKey: "errors.readOnly",
    });
  });
});
