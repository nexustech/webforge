import { describe, expect, it } from "vitest";
import { bundledHelpLibrary, helpLibraryOf } from "./help-library.js";
import { helpLinkDestination } from "./help-navigation.js";

const page = (id: string, title: string) =>
  `---\nid: ${id}\ntitle: ${title}\nsummary: About ${id}.\nrelated: []\nupdated: 2026-11-07\n---\n\n# ${title}\n`;

describe("helpLibraryOf (5.4b)", () => {
  it("reads the pages, leaves out one it can't, and orders them by the contents", () => {
    const library = helpLibraryOf(
      {
        "/docs/help/README.md": "ignored",
        "/docs/help/export.md": page("export", "Export"),
        "/docs/help/publish.md": page("publish", "Publish"),
        "/docs/help/themes.md": page("themes", "Themes"),
        "/docs/help/broken.md": "# No front matter",
      },
      "## Contents\n\n**Going live**\n- [Publish](publish.md)\n- [Gone](gone.md)\n- [Export](export.md)\n",
    );

    expect([...library.pages.keys()].sort()).toEqual(["export", "publish", "themes"]);
    expect(library.contents).toEqual([{ title: "Going live", pages: ["publish", "export"] }]);
    // Search goes through the contents' order, then the pages the contents leave out.
    expect(library.ordered.map((each) => each.id)).toEqual(["publish", "export", "themes"]);
  });
});

describe("bundledHelpLibrary (HP-6)", () => {
  it("bundles every page in docs/help, each read, and lists each in the contents", () => {
    // Every file in the folder, as Vite finds them, without reading them.
    const files = Object.keys(import.meta.glob("../../../../../docs/help/*.md"))
      .map((path) => path.slice(path.lastIndexOf("/") + 1, -3))
      .filter((name) => name !== "README")
      .sort();
    expect(files.length).toBeGreaterThan(20);
    const library = bundledHelpLibrary();

    expect([...library.pages.keys()].sort()).toEqual(files);
    expect(library.contents.flatMap((group) => group.pages).sort()).toEqual(files);
    expect(bundledHelpLibrary()).toBe(library);
  });
});

describe("helpLinkDestination", () => {
  it("keeps links between pages in Help, opens the web in the browser, and nothing else", () => {
    expect(helpLinkDestination("forms.md", "site-check")).toEqual({
      kind: "help",
      target: { page: "forms" },
    });
    expect(helpLinkDestination("pages.md#page-settings", "site-check")).toEqual({
      kind: "help",
      target: { page: "pages", anchor: "page-settings" },
    });
    expect(helpLinkDestination("#tips", "site-check")).toEqual({
      kind: "help",
      target: { page: "site-check", anchor: "tips" },
    });
    expect(helpLinkDestination("https://www.example.org/a?b", "x")).toEqual({
      kind: "web",
      url: "https://www.example.org/a?b",
    });
    for (const href of ["", "#", "../../research/x.md", "mailto:rosa@example.org", "file:///c"]) {
      expect(helpLinkDestination(href, "x")).toEqual({ kind: "none" });
    }
    expect(helpLinkDestination("#tips", undefined)).toEqual({ kind: "none" });
  });
});
