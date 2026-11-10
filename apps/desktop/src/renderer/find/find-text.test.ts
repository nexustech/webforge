import {
  insertPage,
  type NodeDoc,
  newId,
  type PageId,
  type SharedSectionId,
  type SiteDoc,
} from "@webforge/model";
import { siteLibrary } from "@webforge/site-components";
import { describe, expect, it } from "vitest";
import { starterSite } from "../../shared/starter-site.js";
import {
  type FindOptions,
  findInSite,
  findInValue,
  matcher,
  replaceInSite,
  replaceInValue,
  type TextSpot,
} from "./find-text.js";

/** `site` changed by `recipe`, as an edit would: on a copy. */
function produce(site: SiteDoc, recipe: (draft: SiteDoc) => void): SiteDoc {
  const draft = structuredClone(site);
  recipe(draft);
  return draft;
}

const SMITH: FindOptions = { query: "Smith", matchCase: false, wholeWords: false };

const heading = (id: string, text: string, more: Record<string, unknown> = {}): NodeDoc => ({
  type: "Heading",
  props: { id, text, ...more },
});

const text = (id: string, html: string): NodeDoc => ({ type: "Text", props: { id, text: html } });

const copyOf = (id: string, sharedSectionId: SharedSectionId): NodeDoc => ({
  type: "SharedSectionCopy",
  props: { id, sharedSectionId },
});

/** A site with Smiths everywhere: two pages, the Footer, a shared section on both, Site Settings. */
function smithsSite(): { site: SiteDoc; home: PageId; about: PageId; shared: SharedSectionId } {
  const shared = newId("sharedSection");
  const about = newId("page");
  const site = produce(starterSite(), (draft) => {
    insertPage(draft, about, "About Smith");
    const home = draft.pages[draft.homePageId];
    if (home === undefined) throw new Error("No home page");
    home.title = "Smith & Sons";
    home.settings.description = "Plumbers since 1982";
    home.doc.content = [
      heading("hello", "Smith & Sons, smith and SMITH"),
      text("story", "<p>Ask for <strong>Smith</strong> &amp; Smithson about pipes &lt;1m&gt;.</p>"),
      heading("bound", "Smith", { bindings: { text: "general.name" } }),
      { type: "Video", props: { id: "video", address: "https://smith.example/video" } },
      copyOf("copy-home", shared),
    ];
    const aboutPage = draft.pages[about];
    if (aboutPage === undefined) throw new Error("No about page");
    aboutPage.doc.content = [copyOf("copy-about", shared)];
    draft.layout.footer = [{ type: "Footer", props: { id: "footer", text: "© Smith & Sons" } }];
    draft.sharedSections[shared] = {
      id: shared,
      name: "Opening times",
      section: {
        type: "Section",
        props: { id: "hours", content: [heading("hours-title", "Smith's hours")] },
      },
    };
    draft.settings.contact.businessName = "Smith & Sons Ltd";
    draft.settings.contact.email = "smith@example.com";
  });
  return { site, home: site.homePageId, about, shared };
}

describe("matcher", () => {
  it("finds nothing while there's nothing to find", () => {
    expect(matcher({ ...SMITH, query: "" })).toBeUndefined();
  });

  it("takes what's typed literally, never as a pattern", () => {
    const re = matcher({ ...SMITH, query: "£10 (each)." });
    expect("Only £10 (each). Or £10 (eachX".match(re ?? /$^/)).toEqual(["£10 (each)."]);
  });

  it("matches capitals or not, and whole words of any language", () => {
    const value = "Smith smith Smithson Größe größer";
    expect(findInValue(value, false, matcher(SMITH) ?? /$^/)).toHaveLength(3);
    expect(findInValue(value, false, matcher({ ...SMITH, matchCase: true }) ?? /$^/)).toHaveLength(
      2,
    );
    expect(findInValue(value, false, matcher({ ...SMITH, wholeWords: true }) ?? /$^/)).toHaveLength(
      2,
    );
    const große = matcher({ query: "Größe", matchCase: false, wholeWords: true }) ?? /$^/;
    expect(findInValue(value, false, große)).toHaveLength(1);
  });
});

describe("findInValue and replaceInValue", () => {
  const re = matcher(SMITH) ?? /$^/;

  it("gives each match with the text either side", () => {
    expect(findInValue("Call Smith today", false, re)).toEqual([
      { before: "Call ", found: "Smith", after: " today" },
    ]);
  });

  it("reads rich text's text only, decoded, and leaves its tags and marks alone", () => {
    const html = '<p class="smith">Ask <a href="webforge:page/smith">Smith</a> &amp; co</p>';
    expect(findInValue(html, true, re)).toEqual([{ before: "", found: "Smith", after: "" }]);
    expect(replaceInValue(html, true, re, "Smyth & Co <Ltd>")).toEqual({
      value:
        '<p class="smith">Ask <a href="webforge:page/smith">Smyth &amp; Co &lt;Ltd&gt;</a> &amp; co</p>',
      replaced: 1,
    });
  });

  it("keeps a piece of rich text as it was when nothing in it changed", () => {
    const html = "<p>Smith&#39;s &nbsp;pipes</p><p>&lt;b&gt; bold &#x2014;</p>";
    expect(replaceInValue(html, true, re, "Smyth").value).toBe(
      "<p>Smyth's  pipes</p><p>&lt;b&gt; bold &#x2014;</p>",
    );
  });

  it("replaces one match by its place in the list, or every one", () => {
    const value = "Smith, Smith and Smith";
    expect(replaceInValue(value, false, re, "Smyth", 1)).toEqual({
      value: "Smith, Smyth and Smith",
      replaced: 1,
    });
    expect(replaceInValue(value, false, re, "$&$1")).toEqual({
      value: "$&$1, $&$1 and $&$1",
      replaced: 3,
    });
  });
});

describe("findInSite", () => {
  it("lists every page's matches in page order, then the Footer, shared sections, Settings", () => {
    const { site, home, about, shared } = smithsSite();
    const found = findInSite(site, siteLibrary, SMITH);

    expect(found.map(({ spot, matches }) => [spot, matches.length])).toEqual([
      [{ kind: "page", pageId: home, field: "title" }, 1],
      [{ kind: "element", on: home, nodeId: "hello", type: "Heading", field: "text" }, 3],
      [{ kind: "element", on: home, nodeId: "story", type: "Text", field: "text" }, 2],
      [{ kind: "page", pageId: about, field: "title" }, 1],
      [{ kind: "element", on: "footer", nodeId: "footer", type: "Footer", field: "text" }, 1],
      [{ kind: "element", on: shared, nodeId: "hours-title", type: "Heading", field: "text" }, 1],
      [{ kind: "settings", field: "contact.businessName" }, 1],
    ]);
  });

  it("leaves out bound fields, web addresses and e-mail addresses", () => {
    const { site } = smithsSite();
    const spots = findInSite(site, siteLibrary, SMITH).map(({ spot }) => JSON.stringify(spot));

    expect(spots.join()).not.toMatch(/"bound"|"video"|email/);
  });

  it("finds a list item's text", () => {
    const site = produce(starterSite(), (draft) => {
      draft.pages[draft.homePageId]?.doc.content.push({
        type: "FormField",
        props: { id: "field", label: "Choose", options: [{ id: "one", label: "Ask Smith" }] },
      });
    });

    expect(findInSite(site, siteLibrary, SMITH).map(({ spot }) => spot)).toEqual([
      {
        kind: "element",
        on: site.homePageId,
        nodeId: "field",
        type: "FormField",
        field: "options",
        item: { id: "one", field: "label" },
      },
    ]);
  });
});

describe("the menu's labels (F-ED-17)", () => {
  /** A custom menu: Home without a label of its own, Home with one, a button, a dropdown. */
  function menuSite() {
    const ids = {
      plain: newId("menuItem"),
      named: newId("menuItem"),
      button: newId("menuItem"),
      group: newId("menuItem"),
      child: newId("menuItem"),
    };
    const site = produce(starterSite(), (draft) => {
      const pageId = draft.homePageId;
      draft.menu = {
        follows: "custom",
        items: [
          { id: ids.plain, kind: "page", pageId, hidden: false },
          { id: ids.named, kind: "page", pageId, label: "Smith's", hidden: false },
          {
            id: ids.button,
            kind: "button",
            link: { kind: "page", pageId },
            label: "Smith",
            hidden: false,
          },
          {
            id: ids.group,
            kind: "group",
            label: "More",
            hidden: false,
            children: [
              {
                id: ids.child,
                kind: "link",
                link: { kind: "page", pageId },
                label: "Book Smith",
                hidden: false,
              },
            ],
          },
        ],
      };
    });
    return { site, ids };
  }

  it("finds a page item's own label, a button's and a dropdown's links, never a page's name", () => {
    const { site, ids } = menuSite();

    expect(findInSite(site, siteLibrary, SMITH).map(({ spot }) => spot)).toEqual([
      { kind: "menu", itemId: ids.named },
      { kind: "menu", itemId: ids.button },
      { kind: "menu", itemId: ids.child },
    ]);
  });

  it("replaces them, but never leaves a label empty", () => {
    const { site, ids } = menuSite();
    const replace = (replacement: string) =>
      produce(site, (draft) => {
        const spots = findInSite(site, siteLibrary, SMITH).map(({ spot }) => spot);
        replaceInSite(draft, siteLibrary, SMITH, replacement, spots);
      });

    const smyth = replace("Smyth").menu.items;
    expect(smyth.map((item) => item.label)).toEqual([undefined, "Smyth's", "Smyth", "More"]);
    expect(smyth[3]?.kind === "group" ? smyth[3].children[0]?.label : undefined).toBe("Book Smyth");

    // The button would be left without a label: it keeps it.
    const emptied = replace("").menu.items;
    expect(emptied.find((item) => item.id === ids.button)?.label).toBe("Smith");
    expect(emptied.find((item) => item.id === ids.named)?.label).toBe("'s");
  });
});

describe("replaceInSite", () => {
  const replaceAll = (site: SiteDoc, options: FindOptions, replacement: string) =>
    produce(site, (draft) => {
      const spots = findInSite(site, siteLibrary, options).map(({ spot }) => spot);
      replaceInSite(draft, siteLibrary, options, replacement, spots);
    });

  it("replaces everywhere it's found, and a shared section once for all its copies", () => {
    const { site, home, about, shared } = smithsSite();
    const after = replaceAll(site, SMITH, "Smyth");

    expect(after.pages[home]?.title).toBe("Smyth & Sons");
    expect(after.pages[about]?.title).toBe("About Smyth");
    expect(after.pages[home]?.doc.content[0]?.props.text).toBe("Smyth & Sons, Smyth and Smyth");
    expect(after.pages[home]?.doc.content[1]?.props.text).toBe(
      "<p>Ask for <strong>Smyth</strong> &amp; Smythson about pipes &lt;1m&gt;.</p>",
    );
    expect(after.sharedSections[shared]?.section.props.content).toEqual([
      heading("hours-title", "Smyth's hours"),
    ]);
    // Each page still holds its copy: one shared section, replaced once.
    expect(after.pages[about]?.doc.content).toEqual(site.pages[about]?.doc.content);
    expect(after.layout.footer[0]?.props.text).toBe("© Smyth & Sons");
    expect(after.settings.contact.businessName).toBe("Smyth & Sons Ltd");
    // Left alone: a bound field, a web address, an e-mail address.
    expect(after.pages[home]?.doc.content[2]).toEqual(site.pages[home]?.doc.content[2]);
    expect(after.pages[home]?.doc.content[3]).toEqual(site.pages[home]?.doc.content[3]);
    expect(after.settings.contact.email).toBe("smith@example.com");
  });

  it("replaces one match only, in its spot", () => {
    const { site, home } = smithsSite();
    const spot: TextSpot = {
      kind: "element",
      on: home,
      nodeId: "hello",
      type: "Heading",
      field: "text",
    };
    const after = produce(site, (draft) => {
      expect(replaceInSite(draft, siteLibrary, SMITH, "Smyth", [spot], 2)).toEqual([spot]);
    });

    expect(after.pages[home]?.doc.content[0]?.props.text).toBe("Smith & Sons, smith and Smyth");
  });

  it("replaces a list item's text", () => {
    const site = produce(starterSite(), (draft) => {
      draft.pages[draft.homePageId]?.doc.content.push({
        type: "FormField",
        props: { id: "field", label: "Ask", options: [{ id: "one", label: "Ask Smith" }] },
      });
    });
    const after = replaceAll(site, SMITH, "Smyth");

    expect(after.pages[site.homePageId]?.doc.content.at(-1)?.props.options).toEqual([
      { id: "one", label: "Ask Smyth" },
    ]);
  });

  it("never empties a page's title or the site's name, nor makes a field too long", () => {
    const site = produce(starterSite(), (draft) => {
      const home = draft.pages[draft.homePageId];
      if (home !== undefined) {
        home.title = "Smith";
        home.settings.description = "Smith";
      }
      draft.settings.general.name = "Smith";
      draft.settings.contact.openingHoursNote = "Smith";
    });
    const emptied = replaceAll(site, SMITH, "");

    expect(emptied.pages[site.homePageId]?.title).toBe("Smith");
    expect(emptied.settings.general.name).toBe("Smith");
    // Optional fields may be emptied.
    expect(emptied.pages[site.homePageId]?.settings.description).toBe("");
    expect(emptied.settings.contact.openingHoursNote).toBe("");
    const tooLong = replaceAll(site, SMITH, "x".repeat(1000));
    expect(tooLong.pages[site.homePageId]?.title).toBe("Smith");
  });

  it("changes nothing when there's nothing to find, or the element has gone", () => {
    const { site, home } = smithsSite();
    const gone: TextSpot = {
      kind: "element",
      on: home,
      nodeId: "gone",
      type: "Heading",
      field: "text",
    };
    produce(site, (draft) => {
      expect(replaceInSite(draft, siteLibrary, { ...SMITH, query: "" }, "x", [gone])).toEqual([]);
      expect(replaceInSite(draft, siteLibrary, SMITH, "x", [gone])).toEqual([]);
    });
  });
});
