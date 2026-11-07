// The help pages (5.4b, HP-2, HP-6): `docs/help/*.md` read, checked and searched. The app bundles
// them and shows them in its Help window; `pnpm help-check` runs the same checks on the files.
//
// This file has no relative imports, so Node can run `tools/src/check-help.ts` on it directly
// with type stripping, as the other repository scripts run.

import { Lexer, type Token, type Tokens } from "marked";
import { z } from "zod";

/**
 * A page's front matter (HP-2, `docs/help/README.md`): its `id` is its file name without `.md`,
 * which never changes once the app links to it; `components` are the site component types it
 * explains, for *Help for this element*; `updated` is the date it was last checked against the app;
 * `status: partial` marks a feature that's only partly there.
 */
export const helpFrontMatterSchema = z.strictObject({
  id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  title: z.string().min(1),
  summary: z.string().min(1),
  components: z.array(z.string().min(1)).optional(),
  related: z.array(z.string().min(1)),
  updated: z.iso.date(),
  status: z.literal("partial").optional(),
});

/** See {@link helpFrontMatterSchema}. */
export type HelpFrontMatter = z.infer<typeof helpFrontMatterSchema>;

/** A heading of a page, with the anchor a link reaches it by (`pages.md#page-settings`). */
export type HelpHeading = {
  readonly depth: number;
  /** As written, without its Markdown. */
  readonly text: string;
  readonly anchor: string;
};

/** A help page: its front matter, and its text as Markdown tokens for the Help window to draw. */
export type HelpPage = HelpFrontMatter & {
  readonly tokens: readonly Token[];
  readonly headings: readonly HelpHeading[];
  /** Every link's address, as written. */
  readonly links: readonly string[];
  /** All of its words, without Markdown, for search. */
  readonly text: string;
};

/** Why a page couldn't be read: its front matter is missing or doesn't parse. */
export class HelpPageError extends Error {
  override readonly name = "HelpPageError";
}

/** A key and value of the front matter: `id: export`, or a list such as `related: [a, b]`. */
const FIELD = /^([a-z]+):\s*(.*)$/;

/** The front matter's fields, before they're checked, and the Markdown after it. */
function splitFrontMatter(text: string): {
  readonly fields: Record<string, string | string[]>;
  readonly body: string;
} {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(text);
  if (match === null) throw new HelpPageError("It doesn't start with front matter between ---");
  const fields: Record<string, string | string[]> = {};
  for (const line of (match[1] ?? "").split(/\r?\n/)) {
    if (line.trim() === "") continue;
    const field = FIELD.exec(line);
    if (field === null) throw new HelpPageError(`Front matter line not understood: ${line}`);
    const [, key = "", raw = ""] = field;
    if (Object.hasOwn(fields, key)) throw new HelpPageError(`Front matter repeats ${key}`);
    const value = raw.trim();
    const list = /^\[(.*)\]$/.exec(value);
    fields[key] =
      list === null
        ? value
        : (list[1] ?? "")
            .split(",")
            .map((item) => item.trim())
            .filter((item) => item !== "");
  }
  return { fields, body: text.slice(match[0].length) };
}

/** The words of `tokens`, without their Markdown. */
function plainText(tokens: readonly Token[]): string {
  return tokens
    .map((token): string => {
      switch (token.type) {
        case "list":
          return (token as Tokens.List).items.map((item) => plainText(item.tokens)).join("\n");
        case "table": {
          const table = token as Tokens.Table;
          return [table.header, ...table.rows]
            .map((row) => row.map((cell) => plainText(cell.tokens)).join(" "))
            .join("\n");
        }
        case "space":
        case "hr":
        case "html":
          return "";
        case "codespan":
        case "code":
          return (token as Tokens.Codespan).text;
        case "br":
          return "\n";
        default: {
          const inner = (token as { tokens?: Token[] }).tokens;
          if (inner !== undefined) return plainText(inner);
          return "text" in token ? String(token.text) : "";
        }
      }
    })
    .join(separatorOf(tokens));
}

const BLOCKS = new Set(["paragraph", "heading", "list", "table", "code", "blockquote", "hr"]);

/** Blocks on lines of their own; inline tokens run together. */
function separatorOf(tokens: readonly Token[]): string {
  return tokens.some((token) => BLOCKS.has(token.type)) ? "\n" : "";
}

/**
 * The anchor of a heading `text`, as GitHub makes it, so links work on GitHub and in the app alike:
 * lower case, without punctuation, spaces as hyphens. `taken` makes a repeated one unique (`-1`).
 */
export function anchorFor(text: string, taken?: Map<string, number>): string {
  const base = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\- _]/gu, "")
    .replace(/ /g, "-");
  if (taken === undefined) return base;
  const seen = taken.get(base) ?? 0;
  taken.set(base, seen + 1);
  return seen === 0 ? base : `${base}-${seen}`;
}

/** Each token of `tokens`, and every token inside it, in order. */
function* eachToken(tokens: readonly Token[]): Generator<Token> {
  for (const token of tokens) {
    yield token;
    if (token.type === "list") {
      for (const item of (token as Tokens.List).items) yield* eachToken(item.tokens);
    } else if (token.type === "table") {
      const table = token as Tokens.Table;
      for (const cell of [...table.header, ...table.rows.flat()]) yield* eachToken(cell.tokens);
    } else {
      const inner = (token as { tokens?: Token[] }).tokens;
      if (inner !== undefined) yield* eachToken(inner);
    }
  }
}

/** The page in `text`, the contents of `docs/help/<id>.md`; throws {@link HelpPageError}. */
export function parseHelpPage(text: string): HelpPage {
  const { fields, body } = splitFrontMatter(text);
  const front = helpFrontMatterSchema.safeParse(fields);
  if (!front.success) {
    const problem = front.error.issues[0];
    throw new HelpPageError(
      `Front matter: ${problem?.path.join(".") || "page"}: ${problem?.message ?? "invalid"}`,
    );
  }
  // GitHub's Markdown: tables, no raw HTML is checked separately (`checkHelpPages`).
  const tokens = new Lexer({ gfm: true }).lex(body);
  const taken = new Map<string, number>();
  const headings: HelpHeading[] = [];
  const links: string[] = [];
  for (const token of eachToken(tokens)) {
    if (token.type === "heading") {
      const heading = token as Tokens.Heading;
      const plain = plainText(heading.tokens);
      headings.push({ depth: heading.depth, text: plain, anchor: anchorFor(plain, taken) });
    } else if (token.type === "link") {
      links.push((token as Tokens.Link).href);
    }
  }
  return { ...front.data, tokens, headings, links, text: plainText(tokens) };
}

/** A group of the Help window's contents, as `docs/help/README.md` lists them. */
export type HelpContentsGroup = {
  readonly title: string;
  readonly pages: readonly string[];
};

/**
 * The contents in `readme`, `docs/help/README.md`: under its *Contents* heading, each bold line
 * starts a group, and each page it links to after that is in it, in order. A group that links to
 * no page (*Still to come*) is left out.
 */
export function parseHelpContents(readme: string): readonly HelpContentsGroup[] {
  const section = /^## Contents\s*$([\s\S]*?)(?=^## |$(?![\s\S]))/m.exec(readme)?.[1] ?? "";
  const groups: { title: string; pages: string[] }[] = [];
  for (const line of section.split(/\r?\n/)) {
    const title = /^\*\*(.+?)\*\*/.exec(line.trim())?.[1];
    if (title !== undefined) {
      groups.push({ title, pages: [] });
      continue;
    }
    const group = groups.at(-1);
    if (group === undefined || !/^\s*-\s/.test(line)) continue;
    for (const [, id = ""] of line.matchAll(/\]\(([a-z0-9-]+)\.md(?:#[^)]*)?\)/g)) {
      if (!group.pages.includes(id)) group.pages.push(id);
    }
  }
  return groups.filter((group) => group.pages.length > 0);
}

/**
 * The pages whose title, summary or text has every word of `query`, best first: a word in the title
 * counts most, then in the summary. Pages that rank alike keep `pages`' order. Nothing for a query
 * with no words.
 */
export function searchHelp(pages: readonly HelpPage[], query: string): readonly HelpPage[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  return pages
    .map((page, order) => {
      const title = page.title.toLowerCase();
      const summary = page.summary.toLowerCase();
      const text = page.text.toLowerCase();
      if (
        !words.every(
          (word) => title.includes(word) || summary.includes(word) || text.includes(word),
        )
      ) {
        return undefined;
      }
      const score = words.reduce(
        (sum, word) => sum + (title.includes(word) ? 4 : 0) + (summary.includes(word) ? 2 : 0),
        0,
      );
      return { page, order, score };
    })
    .filter((found) => found !== undefined)
    .sort((a, b) => b.score - a.score || a.order - b.order)
    .map(({ page }) => page);
}

/** A **?** link's destination (5.4b): a page, and maybe a heading on it. */
export type HelpLink = { readonly page: string; readonly anchor?: string };

/** What {@link checkHelpPages} checks. */
export type HelpCheckInput = {
  /** Each page's file name (`export.md`) and contents; not the README. */
  readonly files: readonly { readonly name: string; readonly text: string }[];
  /** Every site component type in the catalogue: each must be on exactly one page. */
  readonly componentTypes: readonly string[];
  /** The app's name, which pages write as `{appName}` (`docs/branding.md`). */
  readonly appName: string;
  /** The app's **?** links, each of which must reach a page and heading. */
  readonly links?: readonly HelpLink[];
};

/** A page's link to another page, and maybe a heading: `pages.md#page-settings`, `#tips`. */
const PAGE_LINK = /^(?:([a-z0-9-]+)\.md)?(?:#([^#\s]+))?$/;

/**
 * What's wrong with the help pages (HP-5): front matter that doesn't parse, an `id` that's repeated
 * or isn't its file's name, a link or anchor between pages that doesn't resolve, a link outside the
 * help pages, a `related` page that isn't there, a component type on no page or on two, a page that
 * spells out the app's name, raw HTML or a picture, and a **?** link that reaches no page or heading.
 * Each problem is one line, starting with the file it's in. None means all is well.
 */
export function checkHelpPages(input: HelpCheckInput): readonly string[] {
  const problems: string[] = [];
  const pages = new Map<string, HelpPage>();
  for (const { name, text } of input.files) {
    let page: HelpPage;
    try {
      page = parseHelpPage(text);
    } catch (error) {
      problems.push(`${name}: ${error instanceof Error ? error.message : String(error)}`);
      continue;
    }
    if (`${page.id}.md` !== name) problems.push(`${name}: its id is ${page.id}, not its file name`);
    if (pages.has(page.id)) problems.push(`${name}: the id ${page.id} is used by another page`);
    else pages.set(page.id, page);

    const spelled = new RegExp(`\\b${input.appName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`);
    if (spelled.test(text)) problems.push(`${name}: spells out ${input.appName}; write {appName}`);
    for (const token of eachToken(page.tokens)) {
      if (token.type === "html") problems.push(`${name}: raw HTML: ${token.raw.trim()}`);
      if (token.type === "image") problems.push(`${name}: a picture: ${token.raw.trim()}`);
    }
  }

  const hasAnchor = (id: string, anchor: string | undefined) =>
    anchor === undefined || (pages.get(id)?.headings.some((h) => h.anchor === anchor) ?? false);
  for (const [id, page] of pages) {
    const name = `${id}.md`;
    for (const href of page.links) {
      if (/^(https?:|mailto:)/.test(href)) continue;
      const link = PAGE_LINK.exec(href);
      if (link === null || href === "") {
        problems.push(`${name}: links outside the help pages: ${href}`);
        continue;
      }
      const target = link[1] ?? id;
      if (!pages.has(target)) problems.push(`${name}: links to a page that isn't there: ${href}`);
      else if (!hasAnchor(target, link[2])) {
        problems.push(`${name}: links to a heading that isn't there: ${href}`);
      }
    }
    for (const related of page.related) {
      if (!pages.has(related)) problems.push(`${name}: related page isn't there: ${related}`);
    }
  }

  const known = new Set(input.componentTypes);
  const on = new Map<string, string[]>();
  for (const [id, page] of pages) {
    for (const type of page.components ?? []) {
      if (!known.has(type)) problems.push(`${id}.md: lists a component that isn't one: ${type}`);
      on.set(type, [...(on.get(type) ?? []), id]);
    }
  }
  for (const type of input.componentTypes) {
    const ids = on.get(type) ?? [];
    if (ids.length === 0) problems.push(`components: ${type} is on no page`);
    if (ids.length > 1) problems.push(`components: ${type} is on ${ids.join(" and ")}`);
  }

  for (const { page, anchor } of input.links ?? []) {
    const where = anchor === undefined ? page : `${page}#${anchor}`;
    if (!pages.has(page)) problems.push(`? links: no page ${page}`);
    else if (!hasAnchor(page, anchor)) problems.push(`? links: no heading ${where}`);
  }
  return problems;
}
