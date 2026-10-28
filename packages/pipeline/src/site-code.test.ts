import type { NodeDoc, SiteSnapshot } from "@webforge/model";
import { sampleSite } from "@webforge/test-utils";
import { describe, expect, it } from "vitest";
import { codeCandidates, customCode, scriptMistake } from "./site-code.js";

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

describe("customCode (3.9)", () => {
  it("collects Custom Code from pages, Header and Footer, hidden elements left out, and the page snippets and script", () => {
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

    expect(customCode(site)).toEqual(["<i>F</i>", "<b>S</b>", "<meta>", "go()"]);
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
