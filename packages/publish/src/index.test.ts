import { describe, expect, it } from "vitest";
import { PACKAGE_NAME } from "./index.js";

describe("@webforge/publish", () => {
  it("exposes its package name", () => {
    expect(PACKAGE_NAME).toBe("@webforge/publish");
  });
});
