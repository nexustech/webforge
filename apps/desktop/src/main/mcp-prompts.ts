import type { GetPromptResult, Prompt } from "@modelcontextprotocol/sdk/types.js";
import { t } from "@webforge/i18n";

/** The longest description the prompt takes: a few paragraphs about a business. */
const DESCRIPTION_MAX = 4000;

/**
 * *Build a site from a description* (4.12b, AIB-8): the one prompt the server offers, which Claude
 * Desktop shows in its prompt menu. It takes the person's description of their business. Its
 * title, description and argument's help are the person's to read, so they're translated.
 */
export const buildSitePromptInfo = (): Prompt => ({
  name: "build-site-from-description",
  title: t("ai.prompt.title"),
  description: t("ai.prompt.description"),
  arguments: [{ name: "description", description: t("ai.prompt.argument"), required: false }],
});

/**
 * The prompt's message, sent in the person's name, with their `description` when they gave one:
 * the order of the tools, and what stays with the person (§5.7).
 */
export function buildSitePrompt(description: string | undefined): GetPromptResult {
  const given = description?.trim().slice(0, DESCRIPTION_MAX) ?? "";
  const lines = [
    given === "" ? t("ai.prompt.ask") : t("ai.prompt.from", { description: given }),
    "",
    t("ai.prompt.start"),
    t("ai.prompt.catalogue"),
    t("ai.prompt.plan"),
    t("ai.prompt.check"),
    t("ai.prompt.preview"),
    t("ai.prompt.left"),
    "",
    t("ai.prompt.untrusted"),
  ];
  return {
    description: t("ai.prompt.description"),
    messages: [{ role: "user", content: { type: "text", text: lines.join("\n") } }],
  };
}
