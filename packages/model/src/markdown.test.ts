import { describe, expect, it } from "vitest";
import { csvRecords, parseCsv } from "./csv.js";
import { frontMatter, looksLikeMarkdown, markdownToRichText } from "./markdown.js";

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
