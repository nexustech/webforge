import { describe, expect, it } from "vitest";
import { PACKAGE_NAME } from "./index.js";

describe("@webforge/pipeline", () => {
  it("exposes its package name", () => {
    expect(PACKAGE_NAME).toBe("@webforge/pipeline");
  });
});
