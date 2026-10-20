import { describe, expect, it } from "vitest";
import { cn } from "./cn.js";

describe("cn", () => {
  it("joins classes and lets later Tailwind classes win", () => {
    expect(cn("h-7 px-2", false, undefined, "h-9")).toBe("px-2 h-9");
  });
});
