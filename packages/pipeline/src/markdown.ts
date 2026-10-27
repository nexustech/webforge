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
    const paragraph = tidy(run);
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
    case "blockquote": {
      const quoted = blocksOf(element.children, options).join("\n\n");
      return quoted === "" ? [] : [quoted.replace(/^/gm, "> ").replace(/^> $/gm, ">")];
    }
    case "pre": {
      const code = textOf(element).replace(/\n+$/, "");
      return code === "" ? [] : [`\`\`\`\n${code}\n\`\`\``];
    }
    case "hr":
      return ["---"];
    default:
      return blocksOf(element.children, options);
  }
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
      return `\`${textOf(node).replaceAll("`", "")}\``;
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

/** Text with the characters Markdown would read as formatting escaped. */
function escapeMarkdown(text: string): string {
  return text.replace(/[\\`*_[\]]/g, "\\$&");
}

/** A link's destination, with what would end it early encoded. */
function destination(url: string): string {
  return url.replaceAll(" ", "%20").replaceAll("(", "%28").replaceAll(")", "%29");
}
