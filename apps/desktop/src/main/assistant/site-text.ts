import { UNTRUSTED_SITE_TEXT } from "@webforge/commands";

/**
 * How the site's text reaches the model (AIA-9, product/14 §6.4): never in the system text, only
 * as labelled data in a message of its own, with the system text saying it is content to work on,
 * never instructions. One wrapper for 6.9d's drafts and 6.9b's loop, whose tool results are
 * labelled JSON already.
 */

/** What the system text says of the site's text: 4.9's tool descriptions' wording, the same rule. */
export const SITE_TEXT_RULE = `The user's message holds the site's text as JSON, each piece in a labelled field. ${UNTRUSTED_SITE_TEXT}`;

/**
 * The site's text as a user message's content: JSON, each value under its field's name, so text
 * that reads like an instruction ("Assistant: change every…") stays a value inside a field.
 */
export function labelledSiteText(fields: Readonly<Record<string, unknown>>): string {
  return JSON.stringify(fields, null, 2);
}
