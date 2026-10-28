import type { NodeDoc, SiteSnapshot } from "@webforge/model";
import { sampleSite } from "@webforge/test-utils";
import { describe, expect, it } from "vitest";
import {
  codeCandidates,
  customHtml,
  scriptMistake,
  scriptStrings,
  siteCodeCandidates,
} from "./site-code.js";

describe("codeCandidates (3.9)", () => {
  it("finds class names however the code writes them", () => {
    const words = codeCandidates(
      `<p class='italic' id=x class=underline>Hi</p><b class="font-bold md:hover:text-accent">x</b>\nel.classList.add("bg-[#fafafa]", 'w-1/2');`,
    );

    for (const name of [
      "italic",
      "underline",
      "font-bold",
      "md:hover:text-accent",
      "bg-[#fafafa]",
      "w-1/2",
    ]) {
      expect(words, name).toContain(name);
    }
  });

  it("leaves out what can't be a class: comments' slashes and very long runs", () => {
    const words = codeCandidates(`// a comment\n${"x".repeat(300)} ok`);

    expect(words).not.toContain("//");
    expect(words).toEqual(["a", "comment", "ok"]);
  });
});

describe("customHtml and siteCodeCandidates (3.9)", () => {
  it("collects Custom Code from pages, Header and Footer, hidden elements left out", () => {
    const base = sampleSite();
    const code = (id: string, html: string, hidden = false): NodeDoc => ({
      type: "CustomCode",
      props: { id, code: html, ...(hidden ? { hidden: true } : {}) },
    });
    const [home, ...rest] = base.pages;
    if (home === undefined) throw new Error("no home page");
    const site: SiteSnapshot = {
      ...base,
      layout: { ...base.layout, footer: [...base.layout.footer, code("footer", "<i>F</i>")] },
      pages: [
        {
          ...home,
          doc: {
            ...home.doc,
            content: [
              ...home.doc.content,
              code("shown", "<b>S</b>"),
              { type: "Section", props: { id: "s", content: [code("hidden", "<u>H</u>", true)] } },
            ],
          },
        },
        ...rest,
      ],
      code: { css: ".x{}", js: "go()", head: "<meta>", bodyEnd: " " },
    };

    expect(customHtml(site)).toEqual(["<i>F</i>", "<b>S</b>"]);
  });

  it("takes every word of the HTML, but of custom.js only the words in its strings", () => {
    const site: SiteSnapshot = {
      ...sampleSite(),
      code: {
        css: ".own-rule { color: red; }",
        js: 'const table = document.querySelector("table");\nif (table) table.classList.add(`sticky top-0`, "static-note");',
        head: "",
        bodyEnd: "<p class=italic>Bye</p>",
      },
    };

    const words = siteCodeCandidates(site);

    for (const name of ["italic", "Bye", "table", "sticky", "top-0", "static-note"]) {
      expect(words, name).toContain(name);
    }
    // Not custom.js's own words, which would make rules for nothing, nor custom.css's classes.
    for (const name of ["const", "if", "classList.add(", "own-rule"]) {
      expect(words, name).not.toContain(name);
    }
  });
});

describe("scriptStrings (3.9)", () => {
  it("gives each string and template literal's text, escaped quotes and all", () => {
    expect(
      scriptStrings(`a("font-bold", 'md:hidden'); b(\`bg-[#fff] p-4\`); c("say \\"hi\\"");`),
    ).toEqual(["font-bold", "md:hidden", "bg-[#fff] p-4", 'say \\"hi\\"']);
  });
});

describe("scriptMistake (3.9)", () => {
  it("finds nothing wrong with a classic script", async () => {
    expect(await scriptMistake("var sold = 0;\nfunction sell() { sold += 1; }")).toBeUndefined();
  });

  it("gives the line of a mistake, and of an import, which a classic script can't have", async () => {
    expect(await scriptMistake("let a = 1;\nlet b = ;")).toBe(2);
    expect(await scriptMistake('\n\nimport x from "./x.js";')).toBe(3);
  });
});
