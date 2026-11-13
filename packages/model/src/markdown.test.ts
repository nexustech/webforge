import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { csvRecords, parseCsv } from "./csv.js";
import {
  frontMatter,
  inlineMarkdown,
  looksLikeMarkdown,
  markdownHeading,
  markdownToRichText,
} from "./markdown.js";

describe("markdownToRichText (6.10b, BS9-4)", () => {
  it("makes paragraphs, bold, italic, code and links", () => {
    expect(
      markdownToRichText(
        "We open **at nine** on *Saturday*,\nwith `coffee`.\n\nSee [our menu](https://rosas.example/menu) or [us](javascript:alert).",
      ),
    ).toBe(
      '<p>We open <strong>at nine</strong> on <em>Saturday</em>, with <code>coffee</code>.</p><p>See <a href="https://rosas.example/menu">our menu</a> or us.</p>',
    );
  });

  it("makes headings bold paragraphs, and lists and quotes", () => {
    expect(
      markdownToRichText(
        "## Opening times\n- Mon\n- Tue\n  and Wed\n\n1. One\n2) Two\n\n> Best bread\n> in town",
      ),
    ).toBe(
      "<p><strong>Opening times</strong></p><ul><li><p>Mon</p></li><li><p>Tue and Wed</p></li></ul><ol><li><p>One</p></li><li><p>Two</p></li></ol><blockquote><p>Best bread in town</p></blockquote>",
    );
  });

  it("escapes everything that isn't Markdown, and keeps formatting out of code", () => {
    expect(markdownToRichText('<script>alert("x")</script> & `**not bold**`')).toBe(
      "<p>&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; <code>**not bold**</code></p>",
    );
    expect(markdownToRichText("snake_case_name and 2*3*4")).toBe(
      "<p>snake_case_name and 2*3*4</p>",
    );
    expect(markdownToRichText("\n \n---\n")).toBe("");
  });

  it("says which pasted text reads as Markdown", () => {
    expect(looksLikeMarkdown("# Title")).toBe(true);
    expect(looksLikeMarkdown("- one\n- two")).toBe(true);
    expect(looksLikeMarkdown("A **bold** claim")).toBe(true);
    expect(looksLikeMarkdown("See [this](https://x.example)")).toBe(true);
    expect(looksLikeMarkdown("Just a sentence, 2 * 3.")).toBe(false);
  });
});

/** How long `run` takes, in milliseconds: the fastest of three, as a busy machine may pause one. */
const timed = (run: () => unknown) => {
  let fastest = Number.POSITIVE_INFINITY;
  for (let time = 0; time < 3; time += 1) {
    const start = Date.now();
    run();
    fastest = Math.min(fastest, Date.now() - start);
  }
  return fastest;
};

/** The tags in rich text `html`, each closed in the order opened, of the kinds rich text has. */
function wellFormed(html: string): boolean {
  const open: string[] = [];
  for (const [, closing, name] of html.matchAll(/<(\/?)([a-z]+)[^>]*>/g)) {
    if (!["p", "strong", "em", "code", "a", "ul", "ol", "li", "blockquote"].includes(name ?? "")) {
      return false;
    }
    if (closing === "") open.push(name ?? "");
    else if (open.pop() !== name) return false;
  }
  // Every other `<` and `>` is escaped.
  return open.length === 0 && !/[<>]/.test(html.replace(/<\/?[a-z]+[^>]*>/g, ""));
}

describe("Markdown that never closes (#974)", () => {
  // Each took seconds to minutes before (quadratic, or worse), on the window's main thread: a
  // megabyte of bold left open, a quarter of an hour, and 200 KB of it, half a minute. Converting
  // a megabyte takes a few milliseconds now, as a paragraph is formatted to 10,000 characters;
  // formatting 200 KB of it in full, and asking whether it reads as Markdown, a few dozen, well
  // under a second on a busy machine with coverage on.
  const MB = 1_000_000;
  const KB_200 = 200_000;
  const SECOND = 1000;

  it("converts a megabyte of bold left open in linear time", () => {
    expect(timed(() => markdownToRichText("**a ".repeat(MB / 4)))).toBeLessThan(200);
    const text = "**a ".repeat(KB_200 / 4);
    expect(timed(() => inlineMarkdown(text))).toBeLessThan(SECOND);
    expect(timed(() => looksLikeMarkdown(text))).toBeLessThan(SECOND);
    expect(inlineMarkdown("**b** **c _d")).toBe("<strong>b</strong> **c _d");
  });

  it("reads links left open, headings and italics in linear time", () => {
    for (const text of [
      "[".repeat(KB_200),
      "[a](b".repeat(KB_200 / 5),
      '[a](b "'.repeat(KB_200 / 7),
      "*a ".repeat(KB_200 / 3),
      "_a ".repeat(KB_200 / 3),
      `# a${" ".repeat(KB_200)}b`,
    ]) {
      expect(timed(() => markdownToRichText(text))).toBeLessThan(200);
      expect(timed(() => inlineMarkdown(text))).toBeLessThan(SECOND);
      expect(timed(() => looksLikeMarkdown(text))).toBeLessThan(SECOND);
    }
    expect(markdownHeading(`# a${" ".repeat(MB)}b ##  `)?.text).toBe(`a${" ".repeat(MB)}b`);
    expect(markdownHeading("## Opening times ##")).toEqual({ level: 2, text: "Opening times" });
    expect(markdownHeading("####### Seven")).toBeUndefined();
    expect(markdownHeading("#hashtag")).toBeUndefined();
  });

  it("nests quotes 16 deep at most, a line quoted deeper in the deepest", () => {
    const html = markdownToRichText(`${">".repeat(10_000)} x`);

    expect(html).toBe(`${"<blockquote>".repeat(16)}<p>x</p>${"</blockquote>".repeat(16)}`);
    expect(markdownToRichText("> a\n> > b")).toBe(
      "<blockquote><p>a</p><blockquote><p>b</p></blockquote></blockquote>",
    );
  });

  it("formats the first 10,000 characters of a paragraph, keeping the rest as text", () => {
    const html = markdownToRichText(`**on** ${"a".repeat(10_000)} **off** <b>`);

    expect(html.startsWith("<p><strong>on</strong> a")).toBe(true);
    expect(html.endsWith("a **off** &lt;b&gt;</p>")).toBe(true);
  });

  it("makes well-formed rich text of any text, quickly", () => {
    const markdown = fc.string({
      unit: fc.constantFrom(...'**__`[]()>#-+1. \n"<&ahttps:/'.split(""), "\u2028", "\t"),
      maxLength: 20_000,
    });
    fc.assert(
      fc.property(markdown, (text) => {
        let html = "";
        expect(timed(() => (html = markdownToRichText(text)))).toBeLessThan(SECOND);
        expect(wellFormed(html)).toBe(true);
      }),
      { numRuns: 60 },
    );
  });
});

describe("frontMatter (6.10b)", () => {
  it("reads its keys, quoted values and lists, and gives the text after it", () => {
    const { data, body } = frontMatter(
      '---\nTitle: "Spring opening"\ndate: 2026-03-01\ntags: [News, "Events"]\ncategories:\n  - Bread\n  - Cakes\n---\n# Hello\n',
    );

    expect(data).toEqual({
      title: "Spring opening",
      date: "2026-03-01",
      tags: "News, Events",
      categories: "Bread, Cakes",
    });
    expect(body).toBe("# Hello\n");
    expect(frontMatter("No front matter")).toEqual({ data: {}, body: "No front matter" });
  });
});

describe("parseCsv and csvRecords (6.10b)", () => {
  it("reads quoted fields with commas, quotes and line breaks, and skips empty lines", () => {
    expect(parseCsv('a,b\r\n"one, two","say ""hi""\nthere"\n\n3,\n')).toEqual([
      ["a", "b"],
      ["one, two", 'say "hi"\nthere'],
      ["3", ""],
    ]);
  });

  it("reads semicolons where a spreadsheet saved them, and records by column name", () => {
    expect(csvRecords("Title;Date;__proto__\nSpring;2026-03-01;x\nSummer")).toEqual([
      { title: "Spring", date: "2026-03-01" },
      { title: "Summer", date: "" },
    ]);
    expect(csvRecords("")).toEqual([]);
  });
});
