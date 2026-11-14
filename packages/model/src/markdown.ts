import { escapeHtml } from "./escape.js";

/**
 * Markdown as owners write it elsewhere (6.10b, BS9-4), made into the rich text {appName} keeps: what
 * pasting Markdown into text and importing posts from Markdown give. A small converter of its own,
 * for what rich text can hold: paragraphs, bold, italic, code, links, bullet and numbered lists
 * and quotes. A heading is a bold paragraph, as rich text has no headings; anything else is its
 * text. Every piece of text is escaped, and links go only to web, email and phone addresses.
 */

/** A link's address rich text may hold: the web, email and phone. */
const SAFE_LINK = /^(?:https?:\/\/|mailto:|tel:)/i;

// Every pass over a line below is linear in its length (#974): text pasted from a web page, or a
// 1 MB post imported, can't stall the window on formatting that never closes. None of them uses
// a regular expression that can backtrack over the line, and each search only goes forward.

/** Whether character `code` is a space, as `\s` has it: `NaN`, past either end, isn't. */
function isSpace(code: number): boolean {
  if (code > 32 && code < 160) return false;
  return (
    code === 32 ||
    (code >= 9 && code <= 13) ||
    code === 160 ||
    code === 0x1680 ||
    (code >= 0x2000 && code <= 0x200a) ||
    code === 0x2028 ||
    code === 0x2029 ||
    code === 0x202f ||
    code === 0x205f ||
    code === 0x3000 ||
    code === 0xfeff
  );
}

/** Whether character `code` is a letter, digit or `_`, as `\w` has it. */
const isWord = (code: number) =>
  (code >= 48 && code <= 57) ||
  (code >= 65 && code <= 90) ||
  (code >= 97 && code <= 122) ||
  code === 95;

/** Whether character `code` ends a line, as `.` has it. */
const isLineBreak = (code: number) =>
  code === 10 || code === 13 || code === 0x2028 || code === 0x2029;

/** Every position from `from` on, in a text `length` long: -1 past its end. */
const everyPosition = (length: number) => (from: number) => (from < length ? from : -1);

/**
 * A search of `text` for the first position at or after the one asked that `found` says is one,
 * else `text.length`: asked of positions that never go back, it reads each character once.
 * `next` gives the first position worth asking `found` about from a position on (-1 for none),
 * every one unless it's given.
 */
function searchForward(
  text: string,
  found: (at: number) => boolean,
  next: (from: number) => number = everyPosition(text.length),
): (from: number) => number {
  let last = -1;
  let searched = 0;
  return (from) => {
    if (last >= from) return last;
    for (let at = next(Math.max(from, searched)); at !== -1; at = next(at + 1)) {
      if (found(at)) {
        last = at;
        searched = at + 1;
        return at;
      }
    }
    last = text.length;
    searched = text.length;
    return last;
  };
}

const LINE_BREAKS = /[\n\r\u2028\u2029]/g;

/** The first line break in `text` from position `from` on, or -1. */
function lineBreakFrom(text: string, from: number): number {
  LINE_BREAKS.lastIndex = from;
  return LINE_BREAKS.exec(text)?.index ?? -1;
}

/**
 * The emphasis `mark` (`**`, `__`, `*` or `_`) makes in `text`, as `tag`: from a mark followed by
 * a non-space to the nearest mark after it that follows one, on one line; a mark left open is
 * text. `flanked` (for `*` and `_`) asks that neither mark touch a letter, a digit or another of
 * its own, so `snake_case` and `2*3*4` stay as written.
 */
function emphasis(text: string, mark: string, tag: "strong" | "em", flanked: boolean): string {
  if (!text.includes(mark)) return text;
  const { length } = text;
  const size = mark.length;
  const markCode = mark.charCodeAt(0);
  /** Whether the character at `at` leaves a mark apart, as `flanked` asks. */
  const apart = (at: number) => {
    if (!flanked) return true;
    const code = text.charCodeAt(at);
    return code !== markCode && !isWord(code);
  };
  // The first closing mark and line break from where they were last looked for: each is looked
  // for only past the one found before, as the marks that open come in order.
  let close = -1;
  let lineBreak = -1;
  let out = "";
  let from = 0;
  for (let at = text.indexOf(mark); at !== -1; ) {
    const first = at + size;
    if (apart(at - 1) && first < length && !isSpace(text.charCodeAt(first))) {
      // Its text is a character at least, and ends before the line does.
      if (close < first + 1) {
        close = text.indexOf(mark, first + 1);
        while (close !== -1 && (isSpace(text.charCodeAt(close - 1)) || !apart(close + size))) {
          close = text.indexOf(mark, close + 1);
        }
        if (close === -1) close = length;
      }
      if (lineBreak < first) {
        const found = lineBreakFrom(text, first);
        lineBreak = found === -1 ? length : found;
      }
      if (close < length && lineBreak >= close) {
        out += `${text.slice(from, at)}<${tag}>${text.slice(first, close)}</${tag}>`;
        from = close + size;
        at = text.indexOf(mark, from);
        continue;
      }
    }
    at = text.indexOf(mark, at + 1);
  }
  return out + text.slice(from);
}

/** Bold and italic in escaped text. */
function formatted(text: string): string {
  const bold = emphasis(emphasis(text, "**", "strong", false), "__", "strong", false);
  return emphasis(emphasis(bold, "*", "em", true), "_", "em", true);
}

/**
 * The links in `text`, `[label](address)` or `[label](address "title")`, each replaced by what
 * `link` makes of its label and address; the rest as it is.
 */
function replaceLinks(text: string, link: (label: string, href: string) => string): string {
  if (!text.includes("](")) return text;
  const { length } = text;
  /** A search for `character`, by `indexOf`. */
  const searchFor = (character: string) =>
    searchForward(
      text,
      () => true,
      (from) => text.indexOf(character, from),
    );
  const closeBracket = searchFor("]");
  // Where an address ends: at a `)` or a space.
  const addressEnd = searchForward(
    text,
    (from) => text.charAt(from) === ")" || isSpace(text.charCodeAt(from)),
  );
  const nonSpace = searchForward(text, (from) => !isSpace(text.charCodeAt(from)));
  const quote = searchFor('"');
  /** The `)` that ends a link whose address starts at `href`, or -1 if none does. */
  const linkEnd = (href: number, end: number) => {
    if (end === href || end === length) return -1;
    if (text.charAt(end) === ")") return end;
    // A title, in quotes, after the address.
    const open = nonSpace(end);
    if (text.charAt(open) !== '"') return -1;
    const close = quote(open + 1);
    return text.charAt(close + 1) === ")" ? close + 1 : -1;
  };
  let out = "";
  let from = 0;
  for (let open = text.indexOf("["); open !== -1; ) {
    const label = closeBracket(open + 1);
    if (label > open + 1 && label < length && text.charAt(label + 1) === "(") {
      const href = label + 2;
      const hrefEnd = addressEnd(href);
      const end = linkEnd(href, hrefEnd);
      if (end !== -1) {
        out +=
          text.slice(from, open) + link(text.slice(open + 1, label), text.slice(href, hrefEnd));
        from = end + 1;
        open = text.indexOf("[", from);
        continue;
      }
    }
    open = text.indexOf("[", open + 1);
  }
  return out + text.slice(from);
}

/**
 * One line's inline Markdown as rich text: `code`, [links](https://…), **bold** and *italic*
 * (or `__bold__` and `_italic_`). Code is kept as written, with no formatting in it.
 */
export function inlineMarkdown(line: string): string {
  // Characters for no text (Unicode's private use) hold code and links aside while it's formatted.
  const codes: string[] = [];
  // Code first, so nothing in it is formatting; held aside by its number until the end.
  let text = line.replace(/[\uE000\uE001]/g, "").replace(/`([^`]+)`/g, (_, code: string) => {
    codes.push(`<code>${escapeHtml(code)}</code>`);
    return `\uE000${codes.length - 1}\uE000`;
  });
  const links: string[] = [];
  text = replaceLinks(text, (label, href) => {
    const inner = formatted(escapeHtml(label));
    links.push(SAFE_LINK.test(href) ? `<a href="${escapeHtml(href)}">${inner}</a>` : inner);
    return `\uE001${links.length - 1}\uE001`;
  });
  text = formatted(escapeHtml(text));
  return text
    .replace(/\uE001(\d+)\uE001/g, (_, n: string) => links[Number(n)] ?? "")
    .replace(/\uE000(\d+)\uE000/g, (_, n: string) => codes[Number(n)] ?? "");
}

/**
 * The most of one paragraph that is formatted: a backstop (#974) for a paragraph longer still,
 * whose text past it is kept, unformatted.
 */
const INLINE_MAX = 10_000;

/** `text`'s inline Markdown, for its first {@link INLINE_MAX} characters. */
function inlineCapped(text: string): string {
  if (text.length <= INLINE_MAX) return inlineMarkdown(text);
  // Not between the halves of a character written as two (an emoji).
  const cut = /[\uD800-\uDBFF]/.test(text.charAt(INLINE_MAX - 1)) ? INLINE_MAX - 1 : INLINE_MAX;
  return inlineMarkdown(text.slice(0, cut)) + escapeHtml(text.slice(cut));
}

/**
 * The heading `line` is, `# Title` to `###### Title`: its level (1 for `#`) and its text, without
 * the `#`s that may close it; undefined if it isn't one.
 */
export function markdownHeading(
  line: string,
): { readonly level: number; readonly text: string } | undefined {
  let level = 0;
  while (line.charAt(level) === "#") level += 1;
  if (level === 0 || level > 6 || !isSpace(line.charCodeAt(level))) return undefined;
  let start = level;
  while (isSpace(line.charCodeAt(start))) start += 1;
  // Without the spaces, closing `#`s and spaces after its text, from the end.
  let end = line.length;
  while (end > start && isSpace(line.charCodeAt(end - 1))) end -= 1;
  while (end > start && line.charAt(end - 1) === "#") end -= 1;
  while (end > start && isSpace(line.charCodeAt(end - 1))) end -= 1;
  // Not a heading if its text goes past a line's end, as `.` doesn't.
  for (let at = start; at < end; at += 1) {
    if (isLineBreak(line.charCodeAt(at))) return undefined;
  }
  return { level, text: line.slice(start, end) };
}

const BULLET = /^\s{0,3}[-*+]\s+(.*)$/;
const NUMBERED = /^\s{0,3}\d{1,9}[.)]\s+(.*)$/;
const QUOTE = /^\s{0,3}>\s?(.*)$/;
/** The `>`s a quoted line starts with, at any depth. */
const QUOTE_MARKS = /^(?:\s{0,3}>\s?)+/;
const RULE = /^\s{0,3}([-*_])(?:\s*\1){2,}\s*$/;

/**
 * How deep quotes go in each other (#974): a line quoted deeper is in the deepest, which keeps a
 * line of a thousand `>`s from running out of stack.
 */
const QUOTE_DEPTH = 16;

/** Markdown, `markdown`, as rich text (see the module's comment). Empty for empty Markdown. */
export function markdownToRichText(markdown: string): string {
  return blocksOf(markdown, 0);
}

/** Markdown's blocks as rich text, `depth` quotes deep. */
function blocksOf(markdown: string, depth: number): string {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  const blocks: string[] = [];
  let paragraph: string[] = [];
  let list: { readonly tag: "ul" | "ol"; readonly items: string[] } | undefined;
  let quote: string[] = [];
  const closeParagraph = () => {
    if (paragraph.length > 0) blocks.push(`<p>${inlineCapped(paragraph.join(" "))}</p>`);
    paragraph = [];
  };
  const closeList = () => {
    if (list !== undefined) {
      const items = list.items.map((item) => `<li><p>${inlineCapped(item)}</p></li>`);
      blocks.push(`<${list.tag}>${items.join("")}</${list.tag}>`);
    }
    list = undefined;
  };
  const closeQuote = () => {
    if (quote.length > 0) {
      blocks.push(`<blockquote>${blocksOf(quote.join("\n"), depth + 1)}</blockquote>`);
    }
    quote = [];
  };
  const closeAll = () => {
    closeParagraph();
    closeList();
    closeQuote();
  };
  for (const written of lines) {
    const quoted = QUOTE.exec(written);
    if (quoted !== null && depth < QUOTE_DEPTH) {
      closeParagraph();
      closeList();
      quote.push(quoted[1] ?? "");
      continue;
    }
    // In the deepest quote, a line quoted deeper still is its text.
    const line = quoted === null ? written : written.replace(QUOTE_MARKS, "");
    closeQuote();
    if (line.trim() === "" || RULE.test(line)) {
      closeAll();
      continue;
    }
    const heading = markdownHeading(line);
    if (heading !== undefined) {
      closeAll();
      blocks.push(`<p><strong>${inlineCapped(heading.text)}</strong></p>`);
      continue;
    }
    const bullet = BULLET.exec(line);
    const numbered = bullet === null ? NUMBERED.exec(line) : null;
    const item = bullet ?? numbered;
    if (item !== null) {
      closeParagraph();
      const tag = bullet === null ? "ol" : "ul";
      if (list?.tag !== tag) {
        closeList();
        list = { tag, items: [] };
      }
      list.items.push(item[1] ?? "");
      continue;
    }
    if (list !== undefined && /^\s{2,}\S/.test(line)) {
      // A list item's text going on, indented, on the next line.
      const last = list.items.length - 1;
      list.items[last] = `${list.items[last] ?? ""} ${line.trim()}`;
      continue;
    }
    closeList();
    paragraph.push(line.trim());
  }
  closeAll();
  return blocks.join("");
}

/**
 * Whether plain text pasted into rich text reads as Markdown worth converting: a heading, a list,
 * a quote, bold, a link or code. Plain sentences are pasted as they are.
 */
export function looksLikeMarkdown(text: string): boolean {
  return text.split(/\r?\n/).some((line) => {
    if (markdownHeading(line) !== undefined || BULLET.test(line) || NUMBERED.test(line)) {
      return true;
    }
    if (QUOTE.test(line) || /`[^`]+`/.test(line)) return true;
    let link = false;
    replaceLinks(line, () => {
      link = true;
      return "";
    });
    return link || emphasis(line, "**", "strong", false) !== line;
  });
}

/** A Markdown file's front matter, `---` lines around `key: value` pairs, and the rest. */
export type FrontMatter = {
  readonly data: Readonly<Record<string, string>>;
  readonly body: string;
};

/**
 * The front matter of `text`, if it starts with one: each `key: value` (keys in lower case, values
 * without their quotes, a list such as `[News, Events]` as `News, Events`), and the text after it.
 */
export function frontMatter(text: string): FrontMatter {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text);
  if (match === null) return { data: {}, body: text };
  const data: Record<string, string> = {};
  let listKey: string | undefined;
  for (const line of (match[1] ?? "").split(/\r?\n/)) {
    const item = /^\s*-\s+(.*)$/.exec(line);
    if (item !== null && listKey !== undefined) {
      // A list written one item a line, under its key.
      const value = unquote(item[1] ?? "");
      data[listKey] = data[listKey] === "" ? value : `${data[listKey]}, ${value}`;
      continue;
    }
    const pair = /^([A-Za-z][\w-]*)\s*:\s*(.*)$/.exec(line);
    if (pair === null) continue;
    const key = (pair[1] ?? "").toLowerCase();
    const raw = (pair[2] ?? "").trim();
    listKey = raw === "" ? key : undefined;
    const list = /^\[(.*)\]$/.exec(raw);
    data[key] =
      list === null
        ? unquote(raw)
        : (list[1] ?? "")
            .split(",")
            .map((each) => unquote(each.trim()))
            .filter((each) => each !== "")
            .join(", ");
  }
  return { data, body: text.slice(match[0].length) };
}

const unquote = (value: string) => value.replace(/^(["'])(.*)\1$/, "$2");
