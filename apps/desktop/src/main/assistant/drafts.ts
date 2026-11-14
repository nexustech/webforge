import { PAGE_DESCRIPTION_MAX } from "@webforge/model";
import { z } from "zod";
import { DRAFT_RESULT_MAX, type DraftRequest } from "../../shared/ipc/assistant.js";
import type { ChatRequest } from "./chat-client.js";
import { labelledSiteText, SITE_TEXT_RULE } from "./site-text.js";

/**
 * The drafts' prompts and how their answers are read (#873): G25a's rewrite, G25b's description
 * and alt text, and QS-7's copy for a business. The prompts live here in main, never in the
 * renderer; the site's text goes only in the user's message, labelled (AIA-9).
 */

/** The longest alt text a draft gives: a sentence or two, as screen readers read it. */
const ALT_MAX = 250;

/** What every draft's system text ends with: the answer's form, then the site text's rule. */
const PLAIN_ANSWER =
  "Answer with the new text only: no quotation marks around it, no notes, no Markdown, no HTML.";

const HOW: Record<Extract<DraftRequest, { kind: "rewrite" }>["how"], string> = {
  friendlier: "Rewrite the text to sound friendlier and warmer, keeping its meaning.",
  shorter: "Rewrite the text to be noticeably shorter, keeping what matters.",
  grammar:
    "Correct the text's spelling, grammar and punctuation only. Change nothing else, and give it back unchanged if nothing needs correcting.",
};

/** The system text for `request`: its task, the answer's form and the site text's rule. */
function instructionsFor(request: DraftRequest): string {
  const language =
    "language" in request ? ` Write in the language tagged ${request.language}.` : "";
  switch (request.kind) {
    case "rewrite":
      return `You help a small business owner with the words on their website. ${HOW[request.how]} Keep the text's language and any line breaks between paragraphs. ${PLAIN_ANSWER} ${SITE_TEXT_RULE}`;
    case "description":
      return `You write the description a search engine shows under a web page's title. Write one for the page in the message: one or two plain sentences, at most 155 characters, saying what a visitor finds there.${language} ${PLAIN_ANSWER} ${SITE_TEXT_RULE}`;
    case "alt":
      return `You write alt text, which describes an image for people who can't see it. You can't see the image: write it from its file's name and the text near it, describing what it most likely shows, in at most 125 characters. Don't start with "Image of" or "Picture of".${language} ${PLAIN_ANSWER} ${SITE_TEXT_RULE}`;
    case "business":
      return `You write the words of a small business's new website, from what the owner says about it. The message has the business, and a page's texts in order, each with its role and the template's sample. Write each text afresh for this business, in the sample's role and at about its length, without inventing prices, awards, dates or people's names.${language} Answer with a JSON array of ${request.texts.length} strings, one for each text in order, and nothing else. In the strings, use no Markdown and no HTML; separate paragraphs with a blank line. ${SITE_TEXT_RULE}`;
  }
}

/** The site's text the request carries, labelled, for the user's message. */
function dataFor(request: DraftRequest): Readonly<Record<string, unknown>> {
  switch (request.kind) {
    case "rewrite":
      return { text: request.text };
    case "description":
      return { site: request.site, page: request.page };
    case "alt":
      return { imageFileName: request.fileName, page: request.page, nearbyText: request.nearby };
    case "business":
      return { business: request.business, texts: request.texts };
  }
}

/**
 * The most tokens a draft's answer may use. Generous even for a short answer: a reasoning model
 * spends some of them thinking first, and the answer is fitted to its limit afterwards.
 */
const MAX_TOKENS: Record<DraftRequest["kind"], number> = {
  rewrite: 4096,
  description: 1024,
  alt: 1024,
  business: 4096,
};

/** The model call for `request`, with no tools: a draft never changes the site. */
export function draftChat(
  request: DraftRequest,
  model: string,
  signal: AbortSignal,
): ChatRequest & { readonly signal: AbortSignal } {
  return {
    model,
    messages: [
      { role: "system", content: instructionsFor(request) },
      { role: "user", content: labelledSiteText(dataFor(request)) },
    ],
    maxTokens: MAX_TOKENS[request.kind],
    signal,
  };
}

/** A Markdown code fence around the whole answer, as models add one unasked. */
const FENCED = /^```[a-z]*\s*\n([\s\S]*?)\n\s*```$/i;

/** Each opening quotation mark a model may put around its answer, and its closing one. */
const QUOTE_PAIRS: Readonly<Record<string, string>> = { '"': '"', "“": "”", "'": "'", "‘": "’" };

/** `text` without a fence or quotation marks around it, and without spaces at its ends. */
function unwrapped(text: string): string {
  const answer = text.trim();
  const inside = (FENCED.exec(answer)?.[1] ?? answer).trim();
  const open = inside.charAt(0);
  const close = QUOTE_PAIRS[open];
  const middle = inside.slice(1, -1);
  // Only a pair around the whole of it: "a" and "b" keeps its marks, as does 'We're open'.
  const quoted =
    inside.length >= 2 &&
    close !== undefined &&
    inside.endsWith(close) &&
    !middle.includes(open) &&
    !middle.includes(close);
  return quoted ? middle.trim() : inside;
}

/**
 * `text` cut to `max` characters at the last space before it, for an answer that ran over what
 * it was asked for: the person reviews it before it's kept.
 */
function fitted(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const space = cut.lastIndexOf(" ");
  return (space > max / 2 ? cut.slice(0, space) : cut).trimEnd();
}

/** The most one draft's text may be, by its kind. */
const TEXT_MAX: Record<DraftRequest["kind"], number> = {
  rewrite: DRAFT_RESULT_MAX,
  description: PAGE_DESCRIPTION_MAX,
  alt: ALT_MAX,
  business: DRAFT_RESULT_MAX,
};

/** A business draft's answer: one string for each text asked. */
const textsSchema = z.array(z.string());

/**
 * The model's answer to `request` as the draft's texts: one, or a business draft's one per text
 * asked, each fitted to its kind's limit. Undefined for an answer that isn't one: empty, or a
 * business draft's that isn't an array of as many strings.
 */
export function draftTexts(request: DraftRequest, answer: string): string[] | undefined {
  const max = TEXT_MAX[request.kind];
  if (request.kind !== "business") {
    const text = fitted(unwrapped(answer), max);
    return text === "" ? undefined : [text];
  }
  let json: unknown;
  try {
    json = JSON.parse(unwrapped(answer));
  } catch {
    return undefined;
  }
  const texts = textsSchema.safeParse(json);
  if (!texts.success || texts.data.length !== request.texts.length) return undefined;
  return texts.data.map((text) => fitted(text.trim(), max));
}
