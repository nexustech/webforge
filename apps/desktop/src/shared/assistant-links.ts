import type { ConversationTurn } from "./ipc/assistant.js";

/**
 * Which addresses a reply may open in the person's browser (ADR 0026 §7, `openLink`): only a web
 * address the reply itself holds, so a renderer can't use the call to open anything else. Main
 * checks it against its own copy of the conversation; the panel's stand-in does the same.
 *
 * No pattern runs over the reply: it's model output of up to 200k characters, which a site's text
 * can steer, and main checks it on every click (#1001's review). The panel sends the address as the
 * reply wrote it, its Markdown token's `href`, and a plain search finds it.
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

/** What Markdown adds to a bare `www.` address to make it a link. */
const WWW_SCHEME = "http://";

/**
 * The web address to open for `href`, a link in `turn`'s reply as the reply wrote it: when the
 * reply's text holds it, or a review card's link is it. Otherwise nothing.
 */
export function linkToOpen(turn: ConversationTurn, href: string): string | undefined {
  const address = webAddress(href);
  if (address === undefined) return undefined;
  const inText =
    turn.reply.includes(href) ||
    // A bare `www.example.com` is in the text without the scheme Markdown gave it.
    (href.startsWith(`${WWW_SCHEME}www.`) && turn.reply.includes(href.slice(WWW_SCHEME.length)));
  const inLinks = turn.links.some(
    (link) => link.href === href || webAddress(link.href) === address,
  );
  return inText || inLinks ? address : undefined;
}
