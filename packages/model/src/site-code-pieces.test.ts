import { describe, expect, it } from "vitest";
import type { NodeDoc } from "./documents.js";
import type { CollectionId, SharedSectionId } from "./ids.js";
import { cssNeedsTrust, siteCodePieces, withKeptCode } from "./site-code-pieces.js";
import { createSite } from "./site-doc.js";

const HOURS = "shared-hours" as SharedSectionId;
const BLOG = "blog" as CollectionId;

const code = (id: string, text: string, extra: Record<string, unknown> = {}): NodeDoc => ({
  type: "CustomCode",
  props: { id, code: text, ...extra },
});

/**
 * A site with code in Settings, in the Header, on the home page, hidden, in a shared section and in
 * the Blog's design.
 */
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
    collections: {
      [BLOG]: {
        id: BLOG,
        preset: "blog" as const,
        name: "Blog",
        folder: "blog",
        fields: [],
        design: { before: [], after: [code("design", "<s>every post</s>")] },
      },
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
      // The Blog's design, once, on every post (#936).
      { kind: "element", on: BLOG, nodeId: "design", text: "<s>every post</s>" },
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
    // The Blog's design's too (#936), which every post draws.
    expect(JSON.stringify(kept)).not.toContain("every post");
    expect(siteCodePieces(doc)).toHaveLength(7);
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

describe("the site's CSS, when it can load or show something (#975)", () => {
  const TRACKER = 'body { background: image-set("https://tracker.example/p.png" 1x); }';
  const ESCAPED = String.raw`body { background: \75rl(https://tracker.example/p.png); }`;

  it("needs the owner's yes when it names a file or an address, imports, escapes or sets content", () => {
    for (const css of [
      TRACKER,
      ESCAPED,
      ".a { background: url(media/a.jpg) }",
      '@import "theme.css";',
      '@font-face { src: src("x.woff2") }',
      ".a { background: URL(//cdn.example/a.png) }",
      '.phone::after { content: "0800 000 000" }',
      '.phone::after{content :"x"}',
      '.phone::after { /**/content: "x" }',
    ]) {
      expect(cssNeedsTrust(css), css).toBe(true);
    }
  });

  it("never asks about CSS that only changes how the site looks", () => {
    for (const css of [
      "",
      ".hero { color: oklch(60% 0.1 200); padding: 2rem; }",
      ".row { display: flex; align-content: center; justify-content: space-between; }",
      ":root { --gap: calc(1rem + 2px); }",
    ]) {
      expect(cssNeedsTrust(css), css).toBe(false);
    }
  });

  it("is a piece of code to confirm, which a build leaves out unless kept", () => {
    const doc = { ...site(), code: { ...site().code, css: TRACKER } };

    expect(siteCodePieces(doc)).toContainEqual({ kind: "code", part: "css", text: TRACKER });
    expect(withKeptCode(doc, () => false).code.css).toBe("");
    expect(withKeptCode(doc, (text) => text === TRACKER).code.css).toBe(TRACKER);
  });

  it("isn't asked about, and stays, when it only changes how the site looks", () => {
    const asked: string[] = [];
    const doc = site();
    const kept = withKeptCode(doc, (text) => {
      asked.push(text);
      return false;
    });

    expect(siteCodePieces(doc).map((piece) => piece.kind === "code" && piece.part)).not.toContain(
      "css",
    );
    expect(kept.code.css).toBe(".x {}");
    expect(asked).not.toContain(".x {}");
  });
});
