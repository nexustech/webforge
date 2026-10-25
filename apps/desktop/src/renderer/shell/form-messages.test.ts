import { describe, expect, it } from "vitest";
import { z } from "zod";
import "./form-messages.js";

/** The message `schema` gives `value`, with the editor's words configured. */
const messageOf = (schema: z.ZodType, value: unknown) =>
  schema.safeParse(value).error?.issues[0]?.message;

describe("form messages (2.21)", () => {
  it("say what's wrong with text in the editor's words", () => {
    const name = z.string().trim().min(1).max(5);
    expect(messageOf(name, "  ")).toBe("Fill this in.");
    expect(messageOf(name, "Rosa's")).toBe("Use at most 5 characters.");
    expect(messageOf(z.string().min(3), "ab")).toBe("Use at least 3 characters.");
    expect(messageOf(z.email(), "rosa")).toBe("Use an email address, such as name@example.com.");
  });

  it("say what's wrong with a number, or that one is missing", () => {
    const size = z.number().int().min(320).max(2560);
    expect(messageOf(size, 100)).toBe("Use 320 or more.");
    expect(messageOf(size, 5000)).toBe("Use 2560 or less.");
    expect(messageOf(size, Number.NaN)).toBe("Use a whole number.");
    expect(messageOf(z.object({ width: size }), {})).toBe("Fill this in.");
  });

  it("keep a schema's own wording", () => {
    expect(messageOf(z.string().max(2, "Two letters at most"), "abc")).toBe("Two letters at most");
  });
});
