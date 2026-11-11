/**
 * Markdown as owners write it elsewhere (6.10b, BS9-4), made into the rich text {appName} keeps: what
 * pasting Markdown into text and importing posts from Markdown give. A small converter of its own,
 * for what rich text can hold: paragraphs, bold, italic, code, links, bullet and numbered lists
 * and quotes. A heading is a bold paragraph, as rich text has no headings; anything else is its
 * text. Every piece of text is escaped, and links go only to web, email and phone addresses.
 */

const ESCAPES: Readonly<Record<string, string>> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
};

const escapeText = (text: string) =>
  text.replace(/[&<>"]/g, (character) => ESCAPES[character] ?? "");

/** A link's address rich text may hold: the web, email and phone. */
const SAFE_LINK = /^(?:https?:\/\/|mailto:|tel:)/i;

/**
 * One line's inline Markdown as rich text: `code`, [links](https://…), **bold** and *italic*
 * (or `__bold__` and `_italic_`). Code is kept as written, with no formatting in it.
 */
export function inlineMarkdown(line: string): string {
  // Characters for no text (Unicode's private use) hold code and links aside while it's formatted.
  const codes: string[] = [];
  // Code first, so nothing in it is formatting; held aside by its number until the end.
  let text = line.replace(/[]/g, "").replace(/`([^`]+)`/g, (_, code: string) => {
    codes.push(`<code>${escapeText(code)}</code>`);
    return `\uE000${codes.length - 1}\uE000`;
  });
  const links: string[] = [];
  text = text.replace(
    /\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g,
    (_, label: string, href: string) => {
      const inner = formatted(escapeText(label));
      links.push(SAFE_LINK.test(href) ? `<a href="${escapeText(href)}">${inner}</a>` : inner);
      return `\uE001${links.length - 1}\uE001`;
    },
  );
  text = formatted(escapeText(text));
  return text
    .replace(/\uE001(\d+)\uE001/g, (_, n: string) => links[Number(n)] ?? "")
    .replace(/\uE000(\d+)\uE000/g, (_, n: string) => codes[Number(n)] ?? "");
}

/** Bold and italic in escaped text. */
function formatted(text: string): string {
  return text
    .replace(/\*\*(?=\S)(.+?)(?<=\S)\*\*/g, "<strong>$1</strong>")
    .replace(/__(?=\S)(.+?)(?<=\S)__/g, "<strong>$1</strong>")
    .replace(/(?<![*\w])\*(?=\S)(.+?)(?<=\S)\*(?![*\w])/g, "<em>$1</em>")
    .replace(/(?<![_\w])_(?=\S)(.+?)(?<=\S)_(?![_\w])/g, "<em>$1</em>");
}

const HEADING = /^#{1,6}\s+(.*?)\s*#*\s*$/;
const BULLET = /^\s{0,3}[-*+]\s+(.*)$/;
const NUMBERED = /^\s{0,3}\d{1,9}[.)]\s+(.*)$/;
const QUOTE = /^\s{0,3}>\s?(.*)$/;
const RULE = /^\s{0,3}([-*_])(?:\s*\1){2,}\s*$/;

/** Markdown, `markdown`, as rich text (see the module's comment). Empty for empty Markdown. */
export function markdownToRichText(markdown: string): string {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  const blocks: string[] = [];
  let paragraph: string[] = [];
  let list: { readonly tag: "ul" | "ol"; readonly items: string[] } | undefined;
  let quote: string[] = [];
  const closeParagraph = () => {
    if (paragraph.length > 0) blocks.push(`<p>${inlineMarkdown(paragraph.join(" "))}</p>`);
    paragraph = [];
  };
  const closeList = () => {
    if (list !== undefined) {
      const items = list.items.map((item) => `<li><p>${inlineMarkdown(item)}</p></li>`);
      blocks.push(`<${list.tag}>${items.join("")}</${list.tag}>`);
    }
    list = undefined;
  };
  const closeQuote = () => {
    if (quote.length > 0) {
      blocks.push(`<blockquote>${markdownToRichText(quote.join("\n"))}</blockquote>`);
    }
    quote = [];
  };
  const closeAll = () => {
    closeParagraph();
    closeList();
    closeQuote();
  };
  for (const line of lines) {
    const quoted = QUOTE.exec(line);
    if (quoted !== null) {
      closeParagraph();
      closeList();
      quote.push(quoted[1] ?? "");
      continue;
    }
    closeQuote();
    if (line.trim() === "" || RULE.test(line)) {
      closeAll();
      continue;
    }
    const heading = HEADING.exec(line);
    if (heading !== null) {
      closeAll();
      blocks.push(`<p><strong>${inlineMarkdown(heading[1] ?? "")}</strong></p>`);
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
  return text
    .split(/\r?\n/)
    .some(
      (line) =>
        HEADING.test(line) ||
        BULLET.test(line) ||
        NUMBERED.test(line) ||
        QUOTE.test(line) ||
        /\*\*\S.*?\S\*\*|\[[^\]]+\]\([^)\s]+\)|`[^`]+`/.test(line),
    );
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
