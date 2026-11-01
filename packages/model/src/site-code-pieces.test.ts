import { describe, expect, it } from "vitest";
import type { NodeDoc } from "./documents.js";
import type { SharedSectionId } from "./ids.js";
import { siteCodePieces, withKeptCode } from "./site-code-pieces.js";
import { createSite } from "./site-doc.js";

const HOURS = "shared-hours" as SharedSectionId;

const code = (id: string, text: string, extra: Record<string, unknown> = {}): NodeDoc => ({
  type: "CustomCode",
  props: { id, code: text, ...extra },
});

/** A site with code in Settings, in the Header, on the home page, hidden, and in a shared section. */
function site() {
  const base = createSite({
    name: "Bakery",
    language: "en",
    homeTitle: "Home",
    notFoundTitle: "Not found",
    layout: { header: [code("top", "<b>top</b>")], footer: [code("blank", "  ")] },
    homeDoc: {
      root: { props: {} },
      content: [
        {
          type: "Section",
          props: {
            id: "s",
            content: [code("deep", "<script>skim()</script>"), code("off", "x", { hidden: true })],
          },
        },
      ],
    },
  });
  return {
    ...base,
    code: { css: ".x {}", js: "go()", head: "", bodyEnd: "<i>end</i>" },
    settings: {
      ...base.settings,
      allowedExternalUrls: ["https://a.example/", "https://b.example/x"],
    },
    sharedSections: {
      [HOURS]: { id: HOURS, name: "Hours", section: code("shared", "<u>hours</u>") },
    },
  };
}

describe("siteCodePieces (#649)", () => {
  it("lists the code that runs: Settings' parts, the elements the export draws, the allow-list", () => {
    const doc = site();

    expect(siteCodePieces(doc)).toEqual([
      { kind: "code", part: "bodyEnd", text: "<i>end</i>" },
      { kind: "code", part: "js", text: "go()" },
      { kind: "element", on: "header", nodeId: "top", text: "<b>top</b>" },
      { kind: "element", on: doc.homePageId, nodeId: "deep", text: "<script>skim()</script>" },
      { kind: "element", on: HOURS, nodeId: "shared", text: "<u>hours</u>" },
      { kind: "allowList", text: "https://a.example/\nhttps://b.example/x" },
    ]);
  });
});

describe("withKeptCode (#649)", () => {
  it("blanks the code it doesn't keep, in Settings and in elements anywhere, and keeps the rest", () => {
    const doc = site();
    const kept = withKeptCode(doc, (text) => text === "<b>top</b>" || text === "go()");

    expect(kept.code).toEqual({ css: ".x {}", js: "go()", head: "", bodyEnd: "" });
    expect(siteCodePieces(kept).map((piece) => piece.text)).toEqual([
      "go()",
      "<b>top</b>",
      "https://a.example/\nhttps://b.example/x",
    ]);
    // Hidden elements too, should Layers show them again; the original is untouched.
    expect(JSON.stringify(kept)).not.toContain('"code":"x"');
    expect(JSON.stringify(doc)).toContain('"code":"x"');
    expect(siteCodePieces(doc)).toHaveLength(6);
  });

  it("never asks about blank code", () => {
    const asked: string[] = [];
    withKeptCode(site(), (text) => {
      asked.push(text);
      return true;
    });

    expect(asked).not.toContain("");
    expect(asked).not.toContain("  ");
  });
});
