import { describe, expect, it } from "vitest";
import { SUGGESTION_MAX_CHARS, SUGGESTIONS_MAX } from "../../shared/ipc/assistant.js";
import { SUGGEST_TOOL_DEFINITION, suggestionsOf } from "./assistant-suggest.js";

const of = (value: unknown) => suggestionsOf(JSON.stringify(value));

describe("suggestionsOf (5.17, OL-2)", () => {
  it("keeps up to three, each tidied to one line, in the order given", () => {
    expect(of({ suggestions: ["  Add a gallery ", "Add\tour\nhours", "Three", "Four"] })).toEqual([
      "Add a gallery",
      "Add our hours",
      "Three",
    ]);
    expect(SUGGESTIONS_MAX).toBe(3);
  });

  it(`drops one over ${SUGGESTION_MAX_CHARS} characters, an empty one, a repeat and one that isn't text`, () => {
    const longest = "x".repeat(SUGGESTION_MAX_CHARS);
    expect(
      of({ suggestions: [`${longest}y`, longest, "   ", null, { text: "Hi" }, longest, "Last"] }),
    ).toEqual([longest, "Last"]);
  });

  it("gives none for arguments that aren't a list of them", () => {
    expect(suggestionsOf("not JSON")).toEqual([]);
    expect(suggestionsOf("")).toEqual([]);
    expect(of({ suggestions: "Add a gallery" })).toEqual([]);
    expect(of(["Add a gallery"])).toEqual([]);
    expect(of(null)).toEqual([]);
  });

  it("asks the model for what the panel keeps", () => {
    const { parameters } = SUGGEST_TOOL_DEFINITION.function;
    expect(parameters).toMatchObject({
      required: ["suggestions"],
      properties: {
        suggestions: { maxItems: SUGGESTIONS_MAX, items: { maxLength: SUGGESTION_MAX_CHARS } },
      },
    });
  });
});
