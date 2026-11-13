import type { ConversationTurn } from "./ipc/assistant.js";

/**
 * Which addresses a reply may open in the person's browser (ADR 0026 §7, `openLink`): only a web
 * address the reply itself holds, so a renderer can't use the call to open anything else. Main
 * checks it against its own copy of the conversation; the panel's stand-in does the same.
 */

/** `href` as the panel shows and opens it (`new URL(href).href`), if it's on the web. */
export function webAddress(href: string): string | undefined {
  try {
    const url = new URL(href);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : undefined;
  } catch {
    return undefined;
  }
}

/** A Markdown link's target, `[text](target)`, or a bare `http(s)://…` address in the text. */
const IN_TEXT = /\]\(\s*<?([^)\s>]+)>?[^)]*\)|(https?:\/\/[^\s<>()"'`]+)/gi;

/** Whether `href` is a web address `turn`'s reply holds: in its links, or in its text. */
export function linkInTurn(turn: ConversationTurn, href: string): boolean {
  const wanted = webAddress(href);
  if (wanted === undefined) return false;
  if (turn.links.some((link) => webAddress(link.href) === wanted)) return true;
  for (const [, target, bare] of turn.reply.matchAll(IN_TEXT)) {
    const candidate = target ?? bare;
    // A bare address can end a sentence: its trailing full stop or comma isn't part of it.
    if (candidate !== undefined && webAddress(candidate.replace(/[.,;:!?]+$/, "")) === wanted) {
      return true;
    }
    if (candidate !== undefined && webAddress(candidate) === wanted) return true;
  }
  return false;
}
