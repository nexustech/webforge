import { describe, expect, it } from "vitest";
import { PACKAGE_NAME } from "./index.js";

describe("@webforge/storage", () => {
  it("exposes its package name", () => {
    expect(PACKAGE_NAME).toBe("@webforge/storage");
  });
});
