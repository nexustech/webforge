import { describe, expect, it } from "vitest";
import { errorDetailsOf, errorDetailsSchema, isStackFrame, MAX_FRAMES } from "./error-details.js";

describe("errorDetailsOf (R3)", () => {
  it("keeps an error's name and frames, never its message", () => {
    const error = new TypeError("Can't show \"Rosa's Bakery\"");
    error.stack = [
      `TypeError: Can't show "Rosa's Bakery"`,
      "    at the counter, from 7 every morning",
      "    at Panel (file:///C:/Program%20Files/Webforge/out/renderer/index.js:10:4)",
      "    at Array.map (<anonymous>)",
      "    at http://localhost:5173/src/renderer/App.tsx:3:9",
    ].join("\n");

    const details = errorDetailsOf(error);

    expect(details).toEqual({
      name: "TypeError",
      frames: [
        "at Panel (file:///C:/Program%20Files/Webforge/out/renderer/index.js:10:4)",
        "at Array.map (<anonymous>)",
        "at http://localhost:5173/src/renderer/App.tsx:3:9",
      ],
    });
    expect(JSON.stringify(details)).not.toMatch(/Rosa|counter/);
    expect(errorDetailsSchema.safeParse(details).success).toBe(true);
  });

  it("keeps only the type of something thrown that isn't an Error, and a plain name", () => {
    expect(errorDetailsOf("Rosa's Bakery")).toEqual({ name: "string", frames: [] });
    expect(errorDetailsOf(undefined)).toEqual({ name: "undefined", frames: [] });
    const named = new Error("x");
    named.name = "Rosa's Bakery error";
    expect(errorDetailsOf(named).name).toBe("Error");
  });

  it("keeps at most 30 frames", () => {
    const error = new Error("deep");
    error.stack = [
      "Error: deep",
      ...Array.from({ length: 50 }, (_, n) => `    at f${n} (a.js:${n}:1)`),
    ].join("\n");
    expect(errorDetailsOf(error).frames).toHaveLength(MAX_FRAMES);
  });

  it("tells frames from message lines", () => {
    expect(isStackFrame("at f (a.js:1:2)")).toBe(true);
    expect(isStackFrame("at a.js:1:2")).toBe(true);
    expect(isStackFrame("at new Promise (<anonymous>)")).toBe(true);
    expect(isStackFrame("at the bakery")).toBe(false);
    expect(isStackFrame(`at f (${"x".repeat(600)}:1:2)`)).toBe(false);
  });
});
