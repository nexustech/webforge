import { Parser } from "htmlparser2";

/** An element of a page's HTML, as {@link htmlToMarkdown} reads it. */
type Element = {
  readonly name: string;
  readonly attributes: Readonly<Record<string, string>>;
  readonly children: Node[];
};
type Node = Element | string;

/** What isn't text a reader would want: scripts, forms, embeds, and what's hidden from everyone. */
const SKIPPED = new Set([
  "script",
  "style",
  "noscript",
  "template",
  "svg",
  "iframe",
  "video",
  "audio",
  "object",
  "form",
  "button",
  "nav",
  "dialog",
]);

/** What a reader would come to a section for, left out: a section with only its headings besides. */
const LEFT_OUT_CONTENT = new Set(["form", "iframe", "video", "audio", "object"]);

/** Elements that stand on their own: each one starts a new paragraph. */
const BLOCKS = new Set([
  "address",
  "article",
  "aside",
  "blockquote",
  "dd",
  "details",
  "div",
  "dl",
  "dt",
  "figcaption",
  "figure",
  "footer",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "header",
  "hr",
  "li",
  "main",
  "ol",
  "p",
  "pre",
  "section",
  "summary",
  "table",
  "tbody",
  "td",
  "th",
  "thead",
  "tr",
  "ul",
]);

/** Options of {@link htmlToMarkdown}. */
export type MarkdownOptions = {
  /** The address to give a link or image, from its `href` or `src` as the page has it. */
  readonly url: (href: string) => string;
};

/**
 * A Markdown copy of a page's content (F-EX-5): headings, text, lists, links and images' alt text,
 * for AI tools to read. Elements hidden in Layers are already left out of the HTML; scripts, forms,
 * embeds and what's hidden from every reader (`hidden`, `aria-hidden`) are left out here.
 */
export function htmlToMarkdown(html: string, options: MarkdownOptions): string {
  const blocks = blocksOf(parse(html).children, options);
  return blocks.length === 0 ? "" : `${blocks.join("\n\n")}\n`;
}

/** The element tree of `html`. */
function parse(html: string): Element {
  const root: Element = { name: "", attributes: {}, children: [] };
  const open: Element[] = [root];
  const parser = new Parser(
    {
      onopentag(name, attributes) {
        const element: Element = { name, attributes, children: [] };
        open.at(-1)?.children.push(element);
        open.push(element);
      },
      ontext(text) {
        open.at(-1)?.children.push(text);
      },
      // Void elements and those the parser closes for us come here too, in order.
      onclosetag() {
        if (open.length > 1) open.pop();
      },
    },
    { decodeEntities: true },
  );
  parser.write(html);
  parser.end();
  return root;
}

const isHidden = (element: Element) =>
  SKIPPED.has(element.name) ||
  element.attributes.hidden !== undefined ||
  element.attributes["aria-hidden"] === "true";

/** `nodes` as Markdown blocks: runs of text and inline elements become paragraphs. */
function blocksOf(nodes: readonly Node[], options: MarkdownOptions): string[] {
  const blocks: string[] = [];
  let run = "";
  const endRun = () => {
    const paragraph = escapeLineStarts(tidy(run));
    if (paragraph !== "") blocks.push(paragraph);
    run = "";
  };
  for (const node of nodes) {
    if (typeof node === "string" || !BLOCKS.has(node.name)) {
      run += inline(node, options);
      continue;
    }
    endRun();
    blocks.push(...block(node, options));
  }
  endRun();
  return blocks;
}

/** A block element as Markdown blocks. */
function block(element: Element, options: MarkdownOptions): string[] {
  if (isHidden(element)) return [];
  const heading = /^h([1-6])$/.exec(element.name);
  if (heading !== null) {
    const text = tidy(inlineOf(element.children, options));
    return text === "" ? [] : [`${"#".repeat(Number(heading[1]))} ${text.replaceAll("\n", " ")}`];
  }
  switch (element.name) {
    case "ul":
    case "ol":
      return list(element, options);
    case "dl":
      return definitions(element, options);
    case "blockquote": {
      const quoted = blocksOf(element.children, options).join("\n\n");
      return quoted === "" ? [] : [quoted.replace(/^/gm, "> ").replace(/^> $/gm, ">")];
    }
    case "pre": {
      const code = textOf(element).replace(/\n+$/, "");
      // A fence longer than any run of backticks in the code (CommonMark), and at least three.
      const fence = "`".repeat(Math.max(3, longestBackticks(code) + 1));
      return code === "" ? [] : [`${fence}\n${code}\n${fence}`];
    }
    case "hr":
      return ["---"];
    default: {
      const blocks = blocksOf(element.children, options);
      // A section left with only its headings, its form or embed left out (a contact form's
      // "Write to us"), says nothing: its headings go too.
      return blocks.every((text) => text.startsWith("#")) && leavesOutContent(element)
        ? []
        : blocks;
    }
  }
}

/** Whether `element` holds a form or an embed, which the copy leaves out. */
function leavesOutContent(element: Element): boolean {
  return element.children.some(
    (child) =>
      typeof child !== "string" && (LEFT_OUT_CONTENT.has(child.name) || leavesOutContent(child)),
  );
}

/**
 * A description list as a list, each term with its descriptions on one line: "Tuesday to Friday:
 * 7:00–15:00". Its pairs may each be in a `<div>`, as HTML allows.
 */
function definitions(element: Element, options: MarkdownOptions): string[] {
  const parts = element.children.flatMap((child): Element[] =>
    typeof child === "string" || isHidden(child)
      ? []
      : child.name === "div"
        ? child.children.filter(
            (inner): inner is Element => typeof inner !== "string" && !isHidden(inner),
          )
        : [child],
  );
  const lines: string[] = [];
  let term: string | undefined;
  let details: string[] = [];
  const endPair = () => {
    const text = [term, details.join("; ")].filter((part) => part !== undefined && part !== "");
    if (text.length > 0) lines.push(`- ${text.join(": ")}`);
    term = undefined;
    details = [];
  };
  for (const part of parts) {
    const text = tidy(inlineOf(part.children, options)).replaceAll("\n", " ");
    if (part.name === "dt") {
      // A second term starts a new pair once the first has its descriptions.
      if (details.length > 0 || term !== undefined) endPair();
      term = text;
    } else if (part.name === "dd" && text !== "") {
      details.push(text);
    }
  }
  endPair();
  return lines.length === 0 ? [] : [lines.join("\n")];
}

/** A list, each item's marker before its first line and the rest of it indented under it. */
function list(element: Element, options: MarkdownOptions): string[] {
  const items = element.children.filter(
    (child): child is Element =>
      typeof child !== "string" && child.name === "li" && !isHidden(child),
  );
  const lines = items.flatMap((item, index) => {
    const marker = element.name === "ol" ? `${index + 1}. ` : "- ";
    const [first = "", ...rest] = blocksOf(item.children, options);
    const indent = " ".repeat(marker.length);
    return [
      `${marker}${first.replaceAll("\n", `\n${indent}`)}`,
      ...rest.map((more) => more.replace(/^(?=.)/gm, indent)),
    ];
  });
  return lines.length === 0 ? [] : [lines.join("\n")];
}

/** Inline content as Markdown: emphasis, links, images' alt text and line breaks. */
function inline(node: Node, options: MarkdownOptions): string {
  if (typeof node === "string") return escapeMarkdown(node.replace(/\s+/g, " "));
  if (isHidden(node)) return "";
  // A block inside an inline element (a card that's one link) is kept apart by spaces.
  if (BLOCKS.has(node.name)) return ` ${inlineOf(node.children, options)} `;
  const text = () => inlineOf(node.children, options);
  switch (node.name) {
    case "br":
      return "\n";
    case "strong":
    case "b":
      return wrap(text(), "**");
    case "em":
    case "i":
      return wrap(text(), "*");
    case "code":
      return codeSpan(textOf(node).replace(/\s+/g, " "));
    case "img": {
      const alt = node.attributes.alt?.trim() ?? "";
      const src = node.attributes.src;
      // A decorative image (no alt text) says nothing to a reader.
      return alt === "" || src === undefined
        ? ""
        : `![${escapeMarkdown(alt)}](${destination(options.url(src))})`;
    }
    case "a": {
      const label = tidy(text()).replaceAll("\n", " ");
      const href = node.attributes.href;
      // A link the build couldn't resolve goes nowhere (`#`): its text stays.
      if (href === undefined || href === "#" || href === "") return label;
      const url = options.url(href);
      return `[${label === "" ? escapeMarkdown(url) : label}](${destination(url)})`;
    }
    default:
      return text();
  }
}

const inlineOf = (nodes: readonly Node[], options: MarkdownOptions) =>
  nodes.map((node) => inline(node, options)).join("");

/** The text of `node` as written, for code. */
function textOf(node: Node): string {
  return typeof node === "string" ? node : node.children.map(textOf).join("");
}

/** `text` between `mark`s, the marks inside its spaces so Markdown reads them. */
function wrap(text: string, mark: string): string {
  const match = /^(\s*)([\s\S]*?)(\s*)$/.exec(text);
  const [, before = "", inner = "", after = ""] = match ?? [];
  return inner === "" ? text : `${before}${mark}${inner}${mark}${after}`;
}

/** One space between words, none at the ends of lines, and line breaks kept. */
function tidy(text: string): string {
  return text
    .split("\n")
    .map((line) => line.replace(/ {2,}/g, " ").trim())
    .join("\n")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

/** The longest run of backticks in `text`. */
function longestBackticks(text: string): number {
  return Math.max(0, ...[...text.matchAll(/`+/g)].map((run) => run[0].length));
}

/**
 * Code as written, between runs of backticks longer than any in it, with a space inside each when
 * it starts or ends with a backtick or a space, which CommonMark then takes away (CommonMark 6.1).
 */
function codeSpan(code: string): string {
  if (code === "") return "";
  const fence = "`".repeat(longestBackticks(code) + 1);
  const pad = /^[` ]|[` ]$/.test(code) ? " " : "";
  return `${fence}${pad}${code}${pad}${fence}`;
}

/**
 * A paragraph with what would start a heading, a quote, a list or a rule at the start of a line
 * escaped: "# 1 bakery in town" stays text.
 */
function escapeLineStarts(paragraph: string): string {
  return paragraph
    .replace(/^(?:[#>]|[-+](?=\s|$)|-(?=-))/gm, "\\$&")
    .replace(/^(\d+)([.)])(?=\s|$)/gm, "$1\\$2");
}

/** Text with the characters Markdown would read as formatting escaped. */
function escapeMarkdown(text: string): string {
  return text.replace(/[\\`*_[\]]/g, "\\$&");
}

/** A link's destination, with what would end it early encoded. */
function destination(url: string): string {
  return url.replaceAll(" ", "%20").replaceAll("(", "%28").replaceAll(")", "%29");
}
