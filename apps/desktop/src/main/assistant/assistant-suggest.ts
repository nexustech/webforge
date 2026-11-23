import { z } from "zod";
import { SUGGESTION_MAX_CHARS, SUGGESTIONS_MAX } from "../../shared/ipc/assistant.js";
import type { ChatTool } from "./chat-client.js";

/**
 * The assistant's "what next" suggestions (5.17, OL-2): a tool of the loop's own, never the site's,
 * with which the model offers two or three short requests after a reply that changed the site. The
 * panel shows them as buttons, each sent as the person's next message when tapped, so it is an
 * ordinary message: anything the tools can't do is refused as a typed one would be.
 */

/** The tool's name: no tool of 4.9's layer has it. */
export const SUGGEST_TOOL = "suggestNext";

/** The tool as the model is offered it. */
export const SUGGEST_TOOL_DEFINITION: ChatTool = {
  type: "function",
  function: {
    name: SUGGEST_TOOL,
    description: [
      "After a reply that changed the site, offers the person two or three short requests they",
      "might make next, which they can tap to send. Each must be something your tools can do on",
      "this site, written as the person would ask it, in their language. Call it with your last",
      "words, and only once.",
    ].join(" "),
    parameters: {
      type: "object",
      properties: {
        suggestions: {
          type: "array",
          items: { type: "string", maxLength: SUGGESTION_MAX_CHARS },
          minItems: 2,
          maxItems: SUGGESTIONS_MAX,
          description: `Two or three requests of up to ${SUGGESTION_MAX_CHARS} characters each.`,
        },
      },
      required: ["suggestions"],
      additionalProperties: false,
    },
  },
};

/** The tool's answer to the model: the reply ends with it. */
export const SUGGESTED = JSON.stringify({ status: "done" });

const argumentsSchema = z.looseObject({ suggestions: z.array(z.unknown()) });

/**
 * The suggestions a call's arguments give, as the panel may show them: each trimmed, one on one
 * line, none empty, over {@link SUGGESTION_MAX_CHARS} or a repeat, and the first
 * {@link SUGGESTIONS_MAX} of those. None from arguments that aren't a list of them.
 */
export function suggestionsOf(argumentText: string): string[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(argumentText);
  } catch {
    return [];
  }
  const checked = argumentsSchema.safeParse(parsed);
  if (!checked.success) return [];
  const kept: string[] = [];
  for (const each of checked.data.suggestions) {
    if (typeof each !== "string") continue;
    const text = each.replace(/\s+/g, " ").trim();
    if (text === "" || text.length > SUGGESTION_MAX_CHARS || kept.includes(text)) continue;
    kept.push(text);
    if (kept.length === SUGGESTIONS_MAX) break;
  }
  return kept;
}
