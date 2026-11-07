import { describe, expect, it } from "vitest";
import {
  anchorFor,
  checkHelpPages,
  componentHelp,
  type HelpPage,
  HelpPageError,
  helpComponentsOf,
  parseHelpContents,
  parseHelpPage,
  searchHelp,
} from "./pages.js";

/** A page's file: front matter with `fields` over the defaults, then `body`. */
function page(id: string, body: string, fields: Record<string, string> = {}) {
  const front = {
    id,
    title: id[0]?.toUpperCase() + id.slice(1),
    summary: `All about ${id}.`,
    related: "[]",
    updated: "2026-11-07",
    ...fields,
  };
  const lines = Object.entries(front).map(([key, value]) => `${key}: ${value}`);
  return { name: `${id}.md`, text: `---\n${lines.join("\n")}\n---\n\n${body}\n` };
}

const check = (
  files: ReturnType<typeof page>[],
  options: { componentTypes?: string[]; links?: { page: string; anchor?: string }[] } = {},
) =>
  checkHelpPages({
    files,
    components: (options.componentTypes ?? []).map((type) => ({ type, label: type, children: [] })),
    appName: "Webforge",
    ...(options.links === undefined ? {} : { links: options.links }),
  });

describe("parseHelpPage", () => {
  it("reads the front matter, the headings with their anchors, the links and the words", () => {
    const { text } = page(
      "export",
      [
        "# Export",
        "",
        "**Export** makes your website. See [Site Check](site-check.md#tips).",
        "",
        "## Options and *choices*",
        "",
        "| Option | What it does |",
        "|---|---|",
        "| `Readable` | Keeps the `{year}` |",
        "",
        "- One",
        "- Two, see [below](#options-and-choices)",
        "",
        "## Options and choices",
      ].join("\n"),
      { components: "[Hero, Gallery]", status: "partial" },
    );

    const read = parseHelpPage(text);

    expect(read).toMatchObject({
      id: "export",
      title: "Export",
      components: ["Hero", "Gallery"],
      related: [],
      updated: "2026-11-07",
      status: "partial",
    });
    expect(read.headings.map(({ token: _, ...heading }) => heading)).toEqual([
      { depth: 1, text: "Export", anchor: "export" },
      { depth: 2, text: "Options and choices", anchor: "options-and-choices" },
      { depth: 2, text: "Options and choices", anchor: "options-and-choices-1" },
    ]);
    // Each with its token, for the Help window to draw with its anchor.
    expect(read.headings.map(({ token }) => read.tokens.includes(token))).toEqual([
      true,
      true,
      true,
    ]);
    expect(read.links).toEqual(["site-check.md#tips", "#options-and-choices"]);
    expect(read.text).toContain("Export makes your website. See Site Check.");
    expect(read.text).toContain("Readable Keeps the {year}");
    expect(read.text).toContain("Two, see below");
  });

  it("refuses a page without front matter, or with front matter it can't use", () => {
    expect(() => parseHelpPage("# Export\n")).toThrow(HelpPageError);
    expect(() => parseHelpPage("---\nid: export\njust words\n---\n")).toThrow(/not understood/);
    expect(() => parseHelpPage("---\nid: a\nid: b\n---\n")).toThrow(/repeats id/);
    expect(() => parseHelpPage(page("export", "", { updated: "soon" }).text)).toThrow(/updated/);
    expect(() => parseHelpPage(page("export", "", { colour: "red" }).text)).toThrow(/Front matter/);
    expect(() => parseHelpPage(page("Export Site", "").text)).toThrow(/id/);
  });
});

describe("anchorFor", () => {
  it("makes a heading's anchor as GitHub does, unique on its page", () => {
    expect(anchorFor("Header, Footer and shared sections")).toBe(
      "header-footer-and-shared-sections",
    );
    expect(anchorFor("What's a Café's *theme*?")).toBe("whats-a-cafés-theme");
    const taken = new Map<string, number>();
    expect([anchorFor("Tips", taken), anchorFor("Tips", taken), anchorFor("Tips", taken)]).toEqual([
      "tips",
      "tips-1",
      "tips-2",
    ]);
  });
});

describe("parseHelpContents", () => {
  it("groups the pages under the README's bold lines, leaving out a group with none", () => {
    const readme = [
      "# Help",
      "",
      "## Contents",
      "",
      "**Start here**",
      "- [Getting started](getting-started.md): the start screen",
      "- [The editor](the-editor.md)",
      "",
      "**Building pages**",
      "- [Sections](sections.md) and [Elements](elements.md): everything you can add",
      "- [Pages and the menu](pages.md), with [Page Settings](pages.md#page-settings)",
      "",
      "**Still to come**, written with the features as they merge:",
      "- *Publish*: Netlify (4.4b)",
      "",
      "## Writing a help page",
      "",
      "**Who it's for:** a [link](themes.md)",
    ].join("\n");

    expect(parseHelpContents(readme)).toEqual([
      { title: "Start here", pages: ["getting-started", "the-editor"] },
      { title: "Building pages", pages: ["sections", "elements", "pages"] },
    ]);
    expect(parseHelpContents("# Help\n\nNo contents.\n")).toEqual([]);
  });
});

describe("searchHelp", () => {
  const pages: HelpPage[] = [
    parseHelpPage(page("media", "Pictures you add. You can publish them.").text),
    parseHelpPage(page("publish", "Send your site to your web host.").text),
    parseHelpPage(
      page("export", "Files for your web host.", { summary: "Make files to publish yourself." })
        .text,
    ),
  ];

  it("finds pages with every word, the title's first, then the summary's", () => {
    expect(searchHelp(pages, "publish").map((found) => found.id)).toEqual([
      "publish",
      "export",
      "media",
    ]);
    expect(searchHelp(pages, "WEB host").map((found) => found.id)).toEqual(["publish", "export"]);
    expect(searchHelp(pages, "host pictures")).toEqual([]);
    expect(searchHelp(pages, "   ")).toEqual([]);
  });
});

describe("checkHelpPages (HP-5)", () => {
  it("passes pages that link to each other's pages and headings", () => {
    const files = [
      page(
        "export",
        "# Export\n\nSee [Publish](publish.md) and [its host](publish.md#your-host).\n\n## Hero",
        {
          related: "[publish]",
          components: "[Hero]",
        },
      ),
      page(
        "publish",
        "# Publish\n\n## Your host\n\nBack to [Export](export.md), or [up](#publish).\n\n## Gallery",
        {
          components: "[Gallery]",
        },
      ),
    ];
    expect(
      check(files, {
        componentTypes: ["Hero", "Gallery"],
        links: [{ page: "publish", anchor: "your-host" }, { page: "export" }],
      }),
    ).toEqual([]);
  });

  it("fails front matter that doesn't parse, and an id that's repeated or isn't the file's", () => {
    const renamed = { ...page("export", "# Export"), name: "exporting.md" };
    expect(
      check([page("export", "", { updated: "soon" }), renamed, page("export", "# Export")]),
    ).toEqual([
      "export.md: Front matter: updated: Invalid ISO date",
      "exporting.md: its id is export, not its file name",
      "export.md: the id export is used by another page",
    ]);
  });

  it("fails a link or anchor that doesn't resolve, one outside the pages, and a missing related page", () => {
    const files = [
      page(
        "export",
        [
          "# Export",
          "[a](publish.md) [b](export.md#nowhere) [c](#export) [d](../../research/x.md)",
          "[e](https://example.com) [f](mailto:rosa@example.com)",
        ].join("\n"),
        { related: "[themes]" },
      ),
    ];
    expect(check(files)).toEqual([
      "export.md: links to a page that isn't there: publish.md",
      "export.md: links to a heading that isn't there: export.md#nowhere",
      "export.md: links outside the help pages: ../../research/x.md",
      "export.md: related page isn't there: themes",
    ]);
  });

  it("fails a component type on no page, on two, or one that isn't in the catalogue", () => {
    const files = [
      page("sections", "# Sections\n\n## Hero", { components: "[Hero, Gallery, Banner]" }),
      page("elements", "# Elements", { components: "[Gallery]" }),
    ];
    expect(check(files, { componentTypes: ["Hero", "Gallery", "Map"] })).toEqual([
      "sections.md: lists a component that isn't one: Banner",
      "components: Gallery is on sections and elements",
      "components: Map is on no page",
    ]);
  });

  it("fails a component type with no heading on its page for Help for this element", () => {
    const files = [page("sections", "# Sections\n\n## Hero banner", { components: "[Hero, Map]" })];
    expect(check(files, { componentTypes: ["Hero", "Map"] })).toEqual([
      "components: Map has no heading on sections.md for Help for this element",
    ]);
  });

  it("fails the app's name spelled out, raw HTML and pictures", () => {
    const files = [
      page(
        "export",
        "# Export\n\nWebforge makes it, as {appName} does.\n\n<div>Hi</div>\n\nA <b>bold</b> ![cake](cake.png)",
      ),
    ];
    expect(check(files)).toEqual([
      "export.md: spells out Webforge; write {appName}",
      "export.md: raw HTML: <div>Hi</div>",
      "export.md: raw HTML: <b>",
      "export.md: raw HTML: </b>",
      "export.md: a picture: ![cake](cake.png)",
    ]);
  });

  it("fails a ? link to a page or heading that isn't there", () => {
    const files = [page("export", "# Export\n\n## Options")];
    expect(
      check(files, {
        links: [
          { page: "export", anchor: "options" },
          { page: "export", anchor: "choices" },
          { page: "publish" },
        ],
      }),
    ).toEqual(["? links: no heading export#choices", "? links: no page publish"]);
  });
});

describe("componentHelp (UX-24)", () => {
  const pages = [
    parseHelpPage(
      page(
        "sections",
        "# Sections\n\n## What every section has\n\n## Text + Image\n\n## FAQ\n\n## Gallery",
        { components: "[TextImage, Faq, FaqItem, Gallery, GalleryImage]" },
      ).text,
    ),
    parseHelpPage(
      page(
        "header-and-footer",
        "# Header, Footer and shared sections\n\n## Header and Footer\n\n## Shared sections",
        {
          components: "[Header, Footer]",
        },
      ).text,
    ),
    parseHelpPage(page("elements", "# Elements\n\n## Image", { components: "[Image]" }).text),
  ];
  const components = helpComponentsOf({
    TextImage: { label: "Text + Image", fields: {} },
    Faq: {
      label: "FAQ",
      fields: { items: { kind: "slot", allow: ["FaqItem"] }, title: { kind: "text" } },
    },
    FaqItem: { label: "Question", place: "child", fields: {} },
    Gallery: { label: "Gallery", fields: { images: { kind: "slot", allow: ["GalleryImage"] } } },
    GalleryImage: { label: "Image", place: "child", fields: {} },
    Image: { label: "Image", fields: {} },
    Header: { label: "Header", place: "layout", fields: {} },
    Footer: { label: "Footer", place: "layout", fields: {} },
    Missing: { label: "Missing", fields: {} },
    Section: { label: "Section", fields: { content: { kind: "slot", allow: ["Image", "Faq"] } } },
  });

  it("takes each component's child items from its slots", () => {
    expect(components.find((each) => each.type === "Faq")?.children).toEqual(["FaqItem"]);
    // A section's elements aren't its child items.
    expect(components.find((each) => each.type === "Section")?.children).toEqual([]);
  });

  it("opens each type's page at its own heading, its parent's, or one that names it", () => {
    const help = componentHelp(pages, components);
    expect(Object.fromEntries(help)).toEqual({
      TextImage: { page: "sections", anchor: "text--image" },
      Faq: { page: "sections", anchor: "faq" },
      FaqItem: { page: "sections", anchor: "faq" },
      Gallery: { page: "sections", anchor: "gallery" },
      // Not elements' Image: the page that lists it is the sections page.
      GalleryImage: { page: "sections", anchor: "gallery" },
      Image: { page: "elements", anchor: "image" },
      Header: { page: "header-and-footer", anchor: "header-and-footer" },
      Footer: { page: "header-and-footer", anchor: "header-and-footer" },
    });
  });
});
