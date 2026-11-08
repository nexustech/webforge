import { WebforgeError } from "@webforge/errors";
import { describe, expect, it } from "vitest";
import { ProjectFileError, ReadOnlyProjectError } from "../src/errors.js";

describe("storage's errors (R12)", () => {
  it("are Webforge errors with their code", () => {
    const codes = [
      "not-found",
      "not-a-project",
      "corrupt",
      "unexpected-schema",
      "newer-format",
    ] as const;

    for (const code of codes) {
      const error = new ProjectFileError(code, "for developers");
      expect(error).toBeInstanceOf(WebforgeError);
      expect(error).toMatchObject({ name: "ProjectFileError", code });
    }
    expect(new ReadOnlyProjectError()).toMatchObject({
      name: "ReadOnlyProjectError",
      code: "read-only",
    });
  });
});
