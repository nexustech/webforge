import type { NodeDoc } from "@webforge/model";
import { describe, expect, it } from "vitest";
import { siteLibrary } from "./catalogue/index.js";
import { EDITOR_RENDER_CONTEXT } from "./library.js";
import { mainHeadingsOf } from "./main-heading.js";
import { renderNodesToHtml } from "./render-static.js";

/** `<h1>` start tags in `html`. */
const h1s = (html: string) => html.match(/<h1[\s>]/gi)?.length ?? 0;

describe("a component's main heading (#982)", () => {
  it("is what its definition says, for every component in every choice of its options", () => {
    let id = 0;
    for (const [type, def] of Object.entries(siteLibrary.components)) {
      // Its text in words and its own HTML a heading, so a heading it writes has something in it.
      const base: NodeDoc["props"] = { ...structuredClone(def.defaults), id: "" };
      for (const [name, field] of Object.entries(def.fields)) {
        if (field.kind === "text" || field.kind === "richtext") base[name] = "Rosa's Bakery";
        if (field.kind === "code") base[name] = "<h1>Prices</h1>";
      }
      const choices = Object.entries(def.fields).flatMap(([name, field]) =>
        // Its own options: the Appearance group and the deeper ones draw no heading of their own.
        field.kind === "select" && field.optionGroup === undefined && !name.startsWith("look")
          ? field.options.map((option) => ({ [name]: option.value }))
          : [],
      );
      for (const choice of [{}, ...choices]) {
        const props = { ...base, ...choice, id: `n${id++}` };
        const html = renderNodesToHtml([{ type, props }], siteLibrary, EDITOR_RENDER_CONTEXT);
        expect(mainHeadingsOf(def.mainHeading, props), `${type} ${JSON.stringify(choice)}`).toBe(
          h1s(html),
        );
      }
    }
    // Some 60 components, each in each of its own options: a few hundred renders.
  }, 60_000);

  it("counts a field's words, its HTML's headings, and nothing while `when` doesn't hold", () => {
    const heading = { field: "text", when: { size: "large" } };
    expect(mainHeadingsOf(heading, { text: "Menu", size: "large" })).toBe(1);
    expect(mainHeadingsOf(heading, { text: "Menu", size: "medium" })).toBe(0);
    expect(mainHeadingsOf(heading, { text: "<br>", size: "large" })).toBe(0);
    const code = { field: "code", html: true } as const;
    expect(mainHeadingsOf(code, { code: "<h1>A</h1><H1 class='x'>B</H1><h10>" })).toBe(2);
    expect(mainHeadingsOf(code, { code: 3 })).toBe(0);
    expect(mainHeadingsOf(undefined, { text: "Menu" })).toBe(0);
  });
});
