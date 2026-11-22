import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { siteDocArbitrary } from "../test/arbitraries.js";
import v1Site from "../test/fixtures/v1/site.json" with { type: "json" };
import v2Site from "../test/fixtures/v2/site.json" with { type: "json" };
import v3Site from "../test/fixtures/v3/site.json" with { type: "json" };
import v4Site from "../test/fixtures/v4/site.json" with { type: "json" };
import v5Site from "../test/fixtures/v5/site.json" with { type: "json" };
import v6Site from "../test/fixtures/v6/site.json" with { type: "json" };
import v7Site from "../test/fixtures/v7/site.json" with { type: "json" };
import v8Site from "../test/fixtures/v8/site.json" with { type: "json" };
import v9Site from "../test/fixtures/v9/site.json" with { type: "json" };
import v10Site from "../test/fixtures/v10/site.json" with { type: "json" };
import v11Site from "../test/fixtures/v11/site.json" with { type: "json" };
import v12Site from "../test/fixtures/v12/site.json" with { type: "json" };
import v13Site from "../test/fixtures/v13/site.json" with { type: "json" };
import v14Site from "../test/fixtures/v14/site.json" with { type: "json" };
import v15Site from "../test/fixtures/v15/site.json" with { type: "json" };
import v16Site from "../test/fixtures/v16/site.json" with { type: "json" };
import v17Site from "../test/fixtures/v17/site.json" with { type: "json" };
import v18Site from "../test/fixtures/v18/site.json" with { type: "json" };
import v19Site from "../test/fixtures/v19/site.json" with { type: "json" };
import v20Site from "../test/fixtures/v20/site.json" with { type: "json" };
import { FORMAT_5_DAISYUI_THEMES } from "./format-5-themes.js";
import type { PageId, SharedSectionId } from "./ids.js";
import {
  MIGRATIONS,
  migrateSite,
  migrateSiteWith,
  type RawSite,
  SiteFormatError,
  type SiteMigration,
} from "./migrations.js";
import { createSite, SITE_FORMAT_VERSION, type SiteDoc } from "./site-doc.js";

function formatError(run: () => unknown): SiteFormatError {
  try {
    run();
  } catch (error) {
    if (error instanceof SiteFormatError) return error;
    throw error;
  }
  throw new Error("expected a SiteFormatError");
}

/** Format 5's theme for a site whose theme was daisyUI's `cupcake`, as the fixtures' is. */
const cupcakeTokens = v5Site.theme;

/** Format 5 → 6 (`MIGRATIONS[5]`). */
const sectionPaddingBoxes =
  MIGRATIONS[5] ??
  ((): never => {
    throw new Error("No migration from format 5");
  });

/** Format 6 → 7 (`MIGRATIONS[6]`). */
const themeStyleTokens =
  MIGRATIONS[6] ??
  ((): never => {
    throw new Error("No migration from format 6");
  });

/** Format 7 → 8 (`MIGRATIONS[7]`). */
const ownThemes =
  MIGRATIONS[7] ??
  ((): never => {
    throw new Error("No migration from format 7");
  });

/** Format 8 → 9 (`MIGRATIONS[8]`). */
const componentLooks =
  MIGRATIONS[8] ??
  ((): never => {
    throw new Error("No migration from format 8");
  });

/** Format 9 → 10 (`MIGRATIONS[9]`). */
const sectionContentWidths =
  MIGRATIONS[9] ??
  ((): never => {
    throw new Error("No migration from format 9");
  });

/** Format 10 → 11 (`MIGRATIONS[10]`). */
const accentFonts =
  MIGRATIONS[10] ??
  ((): never => {
    throw new Error("No migration from format 10");
  });

/** Format 11 → 12 (`MIGRATIONS[11]`). */
const destinationsOutOfSettings =
  MIGRATIONS[11] ??
  ((): never => {
    throw new Error("No migration from format 11");
  });

/** Format 12 → 13 (`MIGRATIONS[12]`). */
const siteCollections =
  MIGRATIONS[12] ??
  ((): never => {
    throw new Error("No migration from format 12");
  });

/** Format 13 → 14 (`MIGRATIONS[13]`). */
const collectionTags =
  MIGRATIONS[13] ??
  ((): never => {
    throw new Error("No migration from format 13");
  });

/** Format 14 → 15 (`MIGRATIONS[14]`). */
const listLinks =
  MIGRATIONS[14] ??
  ((): never => {
    throw new Error("No migration from format 14");
  });

/** Format 15 → 16 (`MIGRATIONS[15]`). */
const exampleMarks =
  MIGRATIONS[15] ??
  ((): never => {
    throw new Error("No migration from format 15");
  });

/** Format 16 → 17 (`MIGRATIONS[16]`). */
const ownColours =
  MIGRATIONS[16] ??
  ((): never => {
    throw new Error("No migration from format 16");
  });

/** Format 17 → 18 (`MIGRATIONS[17]`). */
const headerLogo =
  MIGRATIONS[17] ??
  ((): never => {
    throw new Error("No migration from format 17");
  });

/** Format 18 → 19 (`MIGRATIONS[18]`). */
const headerButtons =
  MIGRATIONS[18] ??
  ((): never => {
    throw new Error("No migration from format 18");
  });

/** Format 19 → 20 (`MIGRATIONS[19]`). */
const footerColumns =
  MIGRATIONS[19] ??
  ((): never => {
    throw new Error("No migration from format 19");
  });

/** Format 5 → 16, each step's own fixture tested below: what the later steps do to an older one. */
function latest(site: Record<string, unknown> & { formatVersion: 5 }): unknown {
  return exampleMarks(
    listLinks(
      collectionTags(
        siteCollections(
          destinationsOutOfSettings(
            accentFonts(
              sectionContentWidths(
                componentLooks(
                  ownThemes(
                    themeStyleTokens(sectionPaddingBoxes(JSON.parse(JSON.stringify(site)))),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    ),
  );
}

/**
 * A format 10 site as format 16 opens it: its accent font its headings' (3.22), no publish
 * destinations in its Site Settings (4.4a), and no collections (6.10a).
 */
const asFormat16 = (site: Record<string, unknown>) =>
  exampleMarks(
    listLinks(
      collectionTags(
        siteCollections(
          destinationsOutOfSettings(
            accentFonts(JSON.parse(JSON.stringify({ ...site, formatVersion: 10 }))),
          ),
        ),
      ),
    ),
  );

/**
 * `site` as format 16 had it: format 17 gives its theme an empty list of the person's own colours
 * (TC-1a, #1217), and formats 18 to 20 change nothing a site without a split Header or a
 * _Columns_ Footer has (HF-1, HF-2, HF-4), so what the steps before made of it is compared as it
 * was.
 */
function atFormat16<T extends { formatVersion: number; theme: object }>(site: T) {
  const { ownColors, ...theme } = site.theme as { ownColors?: unknown };
  expect(ownColors).toEqual([]);
  expect(site.formatVersion).toBe(20);
  return { ...site, theme, formatVersion: 16 };
}

/** `settings` without the publish destinations format 12 moved out of them (4.4a). */
function withoutPublish<T extends { publish?: unknown }>(settings: T): Omit<T, "publish"> {
  const { publish: _publish, ...rest } = settings;
  return rest;
}

/**
 * A format 9 site as format 16 opens it: its Sections at Medium, as they were (3.21), its accent
 * font its headings' (3.22), no destinations in its Site Settings (4.4a), and no collections.
 */
const asLatest = (site: Record<string, unknown>) =>
  asFormat16(sectionContentWidths(JSON.parse(JSON.stringify({ ...site, formatVersion: 9 }))));

/** The format 7 fixture as format 16 opens it: its theme still a built-in one. */
const v7AsLatest = asLatest(v7Site);

/** A raw format 9 site with one page holding `nodes`, and what format 10 makes of their props. */
function widthsOf(...nodes: { type: string; props: Record<string, unknown> }[]): unknown[] {
  const site = sectionContentWidths({
    formatVersion: 9,
    pages: {
      home: { doc: { content: nodes.map((node) => ({ ...node, props: { ...node.props } })) } },
    },
  }) as unknown as { pages: { home: { doc: { content: { props: Record<string, unknown> }[] } } } };
  return site.pages.home.doc.content.map((node) => node.props);
}

describe("migrateSite", () => {
  it("opens the format 20 fixture unchanged, its Footer in columns of elements (HF-4)", () => {
    const site = migrateSite(v20Site);

    expect(site).toEqual(v20Site);
    expect(site.formatVersion).toBe(SITE_FORMAT_VERSION);
    const footer = site.layout.footer.find((node) => node.type === "Footer");
    expect(footer?.props).toMatchObject({ variant: "columns", text: "© Rosa's Bakery, Hightown" });
    expect((footer?.props.columns as unknown[] | undefined)?.length).toBe(2);
  });

  it("opens the format 19 fixture as format 20, its Header with a button of its own (HF-2)", () => {
    const site = migrateSite(v19Site);

    // Its Footer, Centred, as it was: no columns means none.
    expect(site).toEqual({ ...v19Site, formatVersion: 20 });
    expect(site.layout.header[0]?.props).toMatchObject({ variant: "split", button: true });
  });

  it("gives a Columns Footer the menu's links in a column, and keeps its text (HF-4)", () => {
    const footer = (props: Record<string, unknown>) => ({
      formatVersion: 19,
      layout: { header: [], footer: [{ type: "Footer", props: { id: "f", text: "©", ...props } }] },
    });
    const migrated = (raw: ReturnType<typeof footer>) =>
      (footerColumns(raw).layout as { footer: { props: Record<string, unknown> }[] }).footer[0]
        ?.props;

    // Its text, its layout, and the links it showed beside it, as Menu links in a column.
    expect(migrated(footer({ variant: "columns" }))).toEqual({
      id: "f",
      text: "©",
      variant: "columns",
      columns: [
        {
          type: "FooterColumn",
          props: { id: "f-links", content: [{ type: "MenuLinks", props: { id: "f-menu" } }] },
        },
      ],
    });
    // Centred, or no layout (Centred), or columns already: as it was.
    expect(migrated(footer({ variant: "centred" }))).toEqual({
      id: "f",
      text: "©",
      variant: "centred",
    });
    expect(migrated(footer({}))).toEqual({ id: "f", text: "©" });
    expect(migrated(footer({ variant: "columns", columns: [] }))).toEqual({
      id: "f",
      text: "©",
      variant: "columns",
      columns: [],
    });
    expect(footerColumns({ formatVersion: 19 })).toEqual({ formatVersion: 20 });
  });

  it("moves the format 18 fixture's menu's last link into its split Header's button (HF-2)", () => {
    const site = migrateSite(v18Site);

    // Its logo kept (HF-1); the link hidden in the menu, as the menu editor hides one.
    expect(site).toEqual({ ...v19Site, formatVersion: 20 });
    expect(site.settings.general.logo).toBe("logo0000000000aa");
    expect(site.menu.items.map((item) => item.hidden)).toEqual([false, false, false, true]);
  });

  it("takes the menu's last link as the export showed it, and leaves other Headers alone (HF-2)", () => {
    const page = (id: string, settings: Record<string, unknown> = {}) => ({
      title: `${id} title`,
      navLabel: `${id} label`,
      settings: { hideFromNavigation: false, ...settings },
    });
    const split = (props: Record<string, unknown> = {}) => ({
      type: "Header",
      props: { id: "header", variant: "split", ...props },
    });
    const site = (items: unknown[], header: unknown[] = [split()]) => ({
      formatVersion: 18,
      pages: {
        home: page("home"),
        book: page("book"),
        hidden: page("hidden", { hideFromNavigation: true }),
        draft: page("draft", { draft: true }),
      },
      media: {},
      menu: { follows: "custom", items },
      layout: { header, footer: [] },
    });
    const item = (pageId: string, extra: Record<string, unknown> = {}) => ({
      id: `m-${pageId}`,
      hidden: false,
      kind: "page",
      pageId,
      ...extra,
    });
    const buttonOf = (raw: ReturnType<typeof site>) =>
      (headerButtons(raw).layout as { header: { props: Record<string, unknown> }[] }).header[0]
        ?.props;
    const hiddenIn = (raw: ReturnType<typeof site>) =>
      (headerButtons(raw).menu as { items: { id: string; hidden: boolean }[] }).items
        .filter((each) => each.hidden)
        .map((each) => each.id);

    // A page's navigation label, past those the navigation leaves out; the menu, following the pages,
    // still does, its item for the page hidden.
    const hiddenItem = item("home", { hidden: true });
    const pages = site([item("home"), item("book"), item("hidden"), item("draft"), hiddenItem]);
    pages.menu.follows = "pages";
    expect(hiddenIn(pages)).toEqual(["m-book", "m-home"]);
    expect((headerButtons(pages).menu as { follows: string }).follows).toBe("pages");
    expect(buttonOf(pages)).toMatchObject({
      button: true,
      buttonLabel: "book label",
      buttonLink: { kind: "page", pageId: "book" },
    });
    // A file gone from Media is left out too; a link's own label and link, its newTab kept.
    const gone = {
      id: "f",
      hidden: false,
      kind: "link",
      label: "Prices",
      link: { kind: "file", mediaId: "x" },
    };
    const web = { kind: "url", href: "https://example.com/book", newTab: true };
    expect(
      buttonOf(site([{ id: "w", hidden: false, kind: "button", label: "Book", link: web }, gone])),
    ).toMatchObject({ button: true, buttonLabel: "Book", buttonLink: web });
    // A dropdown last, or no menu: no button, as before, and the menu as it was.
    const group = {
      id: "g",
      hidden: false,
      kind: "group",
      label: "More",
      children: [item("book")],
    };
    expect(buttonOf(site([item("home"), group]))).not.toHaveProperty("button");
    expect(hiddenIn(site([item("home"), group]))).toEqual([]);
    // A Header that already says, or isn't split: as it was.
    expect(buttonOf(site([item("book")], [split({ button: false })]))).toMatchObject({
      button: false,
    });
    expect(hiddenIn(site([item("book")], [split({ button: false })]))).toEqual([]);
    expect(buttonOf(site([item("book")], [{ type: "Header", props: { id: "h" } }]))).toEqual({
      id: "h",
    });
    expect(headerButtons({ formatVersion: 18 })).toEqual({ formatVersion: 19 });
  });

  it("opens the format 17 fixture as format 20, as it was, with no logo (HF-1)", () => {
    const site = migrateSite(v17Site);

    expect(site).toEqual({ ...v17Site, formatVersion: 20 });
    expect(headerLogo({ formatVersion: 17 })).toEqual({ formatVersion: 18 });
    expect(site.settings.general.logo).toBeUndefined();
    expect(site.theme.ownColors).toEqual([
      { id: "sky", name: "Sky", color: { l: 0.62, c: 0.14, h: 240 } },
    ]);
    expect(site.theme.looks?.CallToAction?.lookBackground).toBe("own-sky-300");
  });

  it("opens the format 16 fixture as format 20, with an empty list of the person's own colours", () => {
    const site = migrateSite(v16Site);

    expect(site).toEqual({
      ...v16Site,
      formatVersion: 20,
      theme: { ...v16Site.theme, ownColors: [] },
    });
    // A list already there is kept, and a theme that isn't a record is left for validation.
    const own = [{ id: "sky", name: "Sky", color: { l: 0.6, c: 0.1, h: 240 } }];
    expect(ownColours({ formatVersion: 16, theme: { ownColors: own } })).toEqual({
      formatVersion: 17,
      theme: { ownColors: own },
    });
    expect(ownColours({ formatVersion: 16, theme: "light" })).toEqual({
      formatVersion: 17,
      theme: "light",
    });
  });

  it("keeps the format 16 fixture's Hero title marked as an example (#1228)", () => {
    const site = migrateSite(v16Site);

    expect(atFormat16(site)).toEqual(v16Site);
    const [hero] = site.pages[Object.keys(site.pages)[0] as PageId]?.doc.content ?? [];
    expect(hero?.props.examples).toEqual({ title: true });
  });

  it("opens the format 15 fixture as format 17, as it was, with no example marked (#1228)", () => {
    const site = migrateSite(v15Site);

    expect(atFormat16(site)).toEqual({ ...v15Site, formatVersion: 16 });
    expect(JSON.stringify(site)).not.toContain('"examples"');
  });

  it("keeps the format 15 fixture's menu linking to its Blog's list (#940)", () => {
    const site = migrateSite(v15Site);

    expect(site.menu.items.at(-1)).toMatchObject({
      kind: "link",
      link: { kind: "list", collectionId: "blog000000000000" },
    });
  });

  it("opens the format 14 fixture as format 17, as it was, with its Blog's tags (6.10b)", () => {
    const site = migrateSite(v14Site);

    expect(atFormat16(site)).toEqual({ ...v14Site, formatVersion: 16 });
    const [blog] = Object.values(site.collections);
    expect(blog?.fields.at(-1)).toEqual({ name: "tags", label: "Tags", kind: "tags" });
  });

  it("opens the format 13 fixture as format 17, its Blog given Tags, its post as it was (6.10b)", () => {
    const site = migrateSite(v13Site);
    const [blog] = Object.values(v13Site.collections);

    expect(atFormat16(site)).toEqual({
      ...v13Site,
      formatVersion: 16,
      collections: {
        [blog?.id ?? ""]: {
          ...blog,
          fields: [...(blog?.fields ?? []), { name: "tags", label: "Tags", kind: "tags" }],
        },
      },
    });
    // A Blog with Tags already, another collection, and a collection that isn't a record are left.
    const tagged = { preset: "blog", fields: [{ name: "tags", label: "Labels", kind: "tags" }] };
    expect(collectionTags({ formatVersion: 13, collections: { a: tagged, b: "none" } })).toEqual({
      formatVersion: 14,
      collections: { a: tagged, b: "none" },
    });
    const [opened] = Object.values(site.collections);
    expect(opened?.preset).toBe("blog");
    const post = Object.values(site.pages).find((page) => page.collection === opened?.id);
    expect(post?.folder).toBe(opened?.folder);
    expect(post?.entry).toMatchObject({ date: "2026-11-10" });
  });

  it("opens the format 12 fixture as format 17, with no collections yet (6.10a)", () => {
    const site = migrateSite(v12Site);

    expect(atFormat16(site)).toEqual({ ...v12Site, formatVersion: 16, collections: {} });
    expect(site.settings).not.toHaveProperty("publish");
    // A site that has collections already keeps them; one whose aren't a record gets none.
    const kept = { blog: { id: "blog" } };
    expect(siteCollections({ formatVersion: 12, collections: kept })).toEqual({
      formatVersion: 13,
      collections: kept,
    });
    expect(siteCollections({ formatVersion: 12, collections: "none" })).toEqual({
      formatVersion: 13,
      collections: {},
    });
  });

  it("opens the format 11 fixture as format 17, its destinations out of Site Settings (4.4a)", () => {
    // The fixture has two, as format 11's schema allowed; no site could have any, as nothing could
    // add one, and a site's destinations are now beside its document (ADR 0018 §2).
    expect(v11Site.settings.publish.destinations).toHaveLength(2);
    const site = migrateSite(v11Site);

    expect(atFormat16(site)).toEqual({
      ...v11Site,
      formatVersion: 16,
      settings: withoutPublish(v11Site.settings),
      collections: {},
    });
    expect(atFormat16(site)).toEqual({ ...v12Site, formatVersion: 16, collections: {} });
    // Settings that aren't a record, or have no destinations, are left for validation.
    for (const settings of ["none", { general: {} }]) {
      expect(destinationsOutOfSettings({ formatVersion: 11, settings })).toEqual({
        formatVersion: 12,
        settings,
      });
    }
  });

  it("opens the format 11 fixture's accent font and a look that takes it (3.22)", () => {
    const site = migrateSite(v11Site);

    expect(site.formatVersion).toBe(SITE_FORMAT_VERSION);
    expect(site.theme.fonts.accent).toEqual({ family: "Playfair Display", fallback: "serif" });
    expect(site.theme.looks?.CallToAction?.lookFont).toBe("accent");
  });

  it("opens the format 10 fixture as format 17, its accent font its headings' (3.22)", () => {
    const site = migrateSite(v10Site);

    expect(atFormat16(site)).toEqual({
      ...v10Site,
      formatVersion: 16,
      collections: {},
      settings: withoutPublish(v10Site.settings),
      theme: {
        ...v10Site.theme,
        fonts: { ...v10Site.theme.fonts, accent: v10Site.theme.fonts.heading },
      },
    });
    // A copy, not the same object: changing one font never changes the other.
    expect(site.theme.fonts.accent).not.toBe(site.theme.fonts.heading);
    // A theme that isn't a record, or has no heading font, is left for validation.
    for (const theme of ["light", { name: "x" }, { fonts: { body: "Inter" } }]) {
      expect(accentFonts({ formatVersion: 10, theme })).toEqual({ formatVersion: 11, theme });
    }
  });

  it("opens the format 10 fixture's Sections' content widths as saved (3.21)", () => {
    const site = migrateSite(v10Site);

    expect(site.sharedSections["shared-hours" as SharedSectionId]?.section.props.contentWidth).toBe(
      "wide",
    );
  });

  it("opens the format 9 fixture as format 17, every Section Medium as it was (3.21)", () => {
    const site = migrateSite(v9Site);
    const sections = [
      ...Object.values(site.pages).flatMap((page) => page.doc.content),
      ...Object.values(site.sharedSections).map((entry) => entry.section),
    ].filter((node) => node.type === "Section");

    expect(sections).toHaveLength(2);
    for (const section of sections) expect(section.props.contentWidth).toBe("medium");
    expect(atFormat16(site)).toEqual(asLatest(v9Site));
  });

  it("gives a Section saved with Full width on Full, and drops the toggle (9 → 10)", () => {
    expect(
      widthsOf(
        { type: "Section", props: { id: "a", fullWidth: true } },
        { type: "Section", props: { id: "b", fullWidth: false } },
        { type: "Section", props: { id: "c" } },
        { type: "Section", props: { id: "d", contentWidth: "narrow", fullWidth: true } },
      ),
    ).toEqual([
      { id: "a", contentWidth: "full" },
      { id: "b", contentWidth: "medium" },
      { id: "c", contentWidth: "medium" },
      { id: "d", contentWidth: "narrow" },
    ]);
  });

  it("keeps the width each layout had where it differed from its kind's default (9 → 10)", () => {
    expect(
      widthsOf(
        { type: "Hero", props: { id: "a", variant: "centred" } },
        { type: "Hero", props: { id: "b", variant: "minimal" } },
        { type: "Hero", props: { id: "c", variant: "split" } },
        { type: "Hero", props: { id: "d" } },
        { type: "CallToAction", props: { id: "e", variant: "split" } },
        { type: "CallToAction", props: { id: "f", variant: "banner" } },
        { type: "Faq", props: { id: "g", variant: "columns" } },
        { type: "Video", props: { id: "h", variant: "split" } },
        { type: "Map", props: { id: "i", variant: "split" } },
        { type: "Map", props: { id: "j", variant: "split", contentWidth: "full" } },
        { type: "Features", props: { id: "k", variant: "list" } },
        // A hand-edited file's names that only an object's prototype has are left alone.
        { type: "constructor", props: { id: "l", variant: "name" } },
        { type: "Hero", props: { id: "m", variant: "toString" } },
      ),
    ).toEqual([
      { id: "a", variant: "centred", contentWidth: "medium" },
      { id: "b", variant: "minimal", contentWidth: "narrow" },
      { id: "c", variant: "split" },
      { id: "d" },
      { id: "e", variant: "split", contentWidth: "wide" },
      { id: "f", variant: "banner" },
      { id: "g", variant: "columns", contentWidth: "wide" },
      { id: "h", variant: "split", contentWidth: "wide" },
      { id: "i", variant: "split", contentWidth: "wide" },
      { id: "j", variant: "split", contentWidth: "full" },
      { id: "k", variant: "list" },
      { id: "l", variant: "name" },
      { id: "m", variant: "toString" },
    ]);
  });

  it("opens the format 9 fixture's theme's looks for Buttons and Calls to action (3.12)", () => {
    const site = migrateSite(v9Site);

    expect(site.theme.looks?.Button).toEqual({
      lookCorners: "full",
      lookShadow: { $responsive: { desktop: "medium", mobile: "none" } },
    });
  });

  it("opens the format 8 fixture as format 17, its theme without looks as it was (3.12)", () => {
    const site = migrateSite(v8Site);

    expect(atFormat16(site)).toEqual(asLatest(v8Site));
    expect(site.theme.looks).toBeUndefined();
    expect(componentLooks({ formatVersion: 8, theme: "light" })).toEqual({
      formatVersion: 9,
      theme: "light",
    });
  });

  it("opens the format 8 fixture's theme the person's own, as it was (2.23)", () => {
    const site = migrateSite(v8Site);

    expect(site.formatVersion).toBe(SITE_FORMAT_VERSION);
    expect(site.theme.own).toEqual({ id: "theme00000000001", name: "Cupcake (my version)" });
  });

  it("opens the format 7 fixture as format 17, its theme a built-in one as it was (2.23)", () => {
    const site = migrateSite(v7Site);

    expect(atFormat16(site)).toEqual(v7AsLatest);
    expect(site.theme.own).toBeUndefined();
    expect(ownThemes({ formatVersion: 7, theme: "light" })).toEqual({
      formatVersion: 8,
      theme: "light",
    });
  });

  it("opens the format 6 fixture as format 17, its theme's style tokens as it looked (2.13d)", () => {
    const site = migrateSite(v6Site);

    expect(v6Site.theme).not.toHaveProperty("cards");
    expect(atFormat16(site)).toEqual(v7AsLatest);
    expect(site.theme).toMatchObject({
      headings: { case: "normal", tracking: "normal" },
      cards: { style: "flat" },
      images: { corners: "rounded" },
      sections: { rhythm: "plain" },
    });
  });

  it("leaves a format 6 theme that isn't a record to validation (6 → 7)", () => {
    expect(themeStyleTokens({ formatVersion: 6, theme: "light" })).toEqual({
      formatVersion: 7,
      theme: "light",
    });
  });

  it("opens the format 5 fixture as format 17, a Section's padding size as its top and bottom (R14)", () => {
    const site = migrateSite(v5Site);

    // The fixture's Sections have format 5's sizes, one plain, one per device.
    const section = v5Site.pages.home000000000000.doc.content.find(
      (node) => node.type === "Section",
    );
    expect(section?.props.padding).toBe("medium");
    expect(v5Site.sharedSections["shared-hours"].section.props.padding).toEqual({
      $responsive: { desktop: "large", mobile: "small" },
    });
    expect(atFormat16(site)).toEqual(v7AsLatest);
    const padding = (id: string) =>
      site.pages["home000000000000" as PageId]?.doc.content.find((node) => node.props.id === id)
        ?.props.padding;
    expect(padding("hours")).toEqual({ top: "m", bottom: "m" });
    expect(site.sharedSections["shared-hours" as SharedSectionId]?.section.props.padding).toEqual({
      $responsive: { desktop: { top: "l", bottom: "l" }, mobile: { top: "s", bottom: "s" } },
    });
  });

  it("leaves a Section's padding that is already a box, or no size, to validation (5 → 6)", () => {
    const section = (padding: unknown) => ({
      formatVersion: 5,
      pages: { home: { doc: { content: [{ type: "Section", props: { id: "s", padding } }] } } },
    });
    const migrated = (padding: unknown) =>
      (sectionPaddingBoxes(section(padding)) as ReturnType<typeof section>).pages.home.doc
        .content[0]?.props.padding;

    expect(migrated({ top: "xl" })).toEqual({ top: "xl" });
    expect(migrated("huge")).toBe("huge");
    expect(migrated({ $responsive: { desktop: { left: "s" }, tablet: "large" } })).toEqual({
      $responsive: { desktop: { left: "s" }, tablet: { top: "l", bottom: "l" } },
    });
    // A Hero's padding was always a box.
    const hero = sectionPaddingBoxes({
      formatVersion: 5,
      pages: {
        home: { doc: { content: [{ type: "Hero", props: { id: "h", padding: "large" } }] } },
      },
    }) as ReturnType<typeof section>;
    expect(hero.pages.home.doc.content[0]?.props.padding).toBe("large");
  });

  it("opens the format 4 fixture as format 17, its theme as tokens named after it (2.1)", () => {
    const site = migrateSite(v4Site);

    expect(atFormat16(site)).toEqual(latest({ ...v4Site, formatVersion: 5, theme: cupcakeTokens }));
    expect(site.theme.preset).toBe("cupcake");
    // daisyUI's own cupcake colours and corners (FORMAT_5_DAISYUI_THEMES; the pipeline's tests
    // compare every built-in theme with daisyUI's).
    expect(site.theme.colors.primary).toEqual({ l: 0.85, c: 0.138, h: 181.071 });
    expect(site.theme.radius).toEqual({ box: "l", field: "xl", selector: "l" });
    expect(site.theme.border).toBe("thick");
  });

  it("gives a format 4 theme naming none of daisyUI's themes the light one (2.1)", () => {
    const named = (name: unknown) => migrateSite({ ...v4Site, theme: { name } }).theme.preset;

    expect([
      named("dracula"),
      named("corporate-2"),
      named("Not A Name"),
      named(3),
      named("constructor"),
    ]).toEqual(["dracula", "light", "light", "light", "light"]);
    expect(migrateSite({ ...v4Site, theme: undefined }).theme.preset).toBe("light");
  });

  it("opens the format 3 fixture as format 17, its shared sections' names made unique (3 → 4)", () => {
    const site = migrateSite(v3Site);

    // The fixture's second shared section repeats the first's name, as format 3 allowed.
    expect(v3Site.sharedSections["shared-hours-weekend"].name).toBe(" opening HOURS ");
    expect(atFormat16(site)).toEqual(
      latest({
        ...v3Site,
        formatVersion: 5,
        theme: cupcakeTokens,
        sharedSections: {
          ...v3Site.sharedSections,
          "shared-hours-weekend": {
            ...v3Site.sharedSections["shared-hours-weekend"],
            name: "opening HOURS 2",
          },
        },
      }),
    );
  });

  it("gives format 3 shared sections that share a name names of their own (1.29)", () => {
    const section = v3Site.sharedSections["shared-hours"];
    const named = (id: string, name: string) => ({ [id]: { ...section, id, name } });
    const long = `${"x".repeat(99)}Y`;
    const site = migrateSite({
      ...v3Site,
      sharedSections: {
        ...named("shared-hours", "Opening hours"),
        ...named("shared-a", "opening HOURS "),
        ...named("shared-b", " Opening hours"),
        ...named("shared-c", "Opening hours 2x"),
        ...named("shared-d", long),
        ...named("shared-e", long.toLowerCase()),
      },
    });

    expect(Object.values(site.sharedSections).map((entry) => entry.name)).toEqual([
      "Opening hours",
      "opening HOURS 2",
      "Opening hours 3",
      "Opening hours 2x",
      long,
      // Shortened to fit the 100 characters a name may have.
      `${"x".repeat(98)} 2`,
    ]);
  });

  it("opens the format 2 fixture as format 17, with no shared sections yet", () => {
    expect(atFormat16(migrateSite(v2Site))).toEqual(
      latest({ ...v2Site, formatVersion: 5, sharedSections: {}, theme: cupcakeTokens }),
    );
  });

  it("opens the format 1 fixture as format 17, its Hero image one value with its alt text (1 → 2)", () => {
    // Fixtures of released formats are never deleted: every old site must keep opening. This one
    // has its Hero image in the format 1 shape: a media id, and its alt text apart.
    const site = migrateSite(v1Site);
    const hero = Object.values(site.pages)
      .flatMap((page) => page.doc.content)
      .find((node) => node.type === "Hero");

    expect(hero?.props.image).toEqual({
      mediaId: "hero000000000000",
      alt: "Fresh loaves on the counter",
    });
    expect(hero?.props).not.toHaveProperty("imageDescription");
    expect(site).toMatchObject({
      formatVersion: SITE_FORMAT_VERSION,
      sharedSections: {},
      theme: cupcakeTokens,
    });
  });

  it("opens a new site after a JSON round trip", () => {
    const site = createSite({
      name: "Rosa's Bakery",
      language: "en",
      homeTitle: "Home",
      notFoundTitle: "Page not found",
    });

    expect(migrateSite(JSON.parse(JSON.stringify(site)))).toEqual(site);
  });

  it("has a migration step for every older format", () => {
    for (let version = 1; version < SITE_FORMAT_VERSION; version++) {
      expect(MIGRATIONS[version]).toBeTypeOf("function");
    }
  });

  it("reports a newer format, so the site can open read-only", () => {
    const error = formatError(() => migrateSite({ ...v1Site, formatVersion: 99 }));

    expect(error.code).toBe("newer-format");
    expect(error.formatVersion).toBe(99);
  });

  it.each([null, [], "site", 1, {}, { formatVersion: 0 }, { formatVersion: 1.5 }])(
    "rejects %j as not a site",
    (raw) => {
      expect(formatError(() => migrateSite(raw)).code).toBe("invalid");
    },
  );

  it("rejects a site that fails validation, naming fields but none of the site's text", () => {
    const broken = { ...v1Site, pageOrder: ["home000000000000"] };
    broken.settings = { ...v1Site.settings, general: { ...v1Site.settings.general, name: "" } };

    const error = formatError(() => migrateSite(broken));

    expect(error.code).toBe("invalid");
    expect(error.formatVersion).toBe(1);
    expect(error.message).toContain("settings.general.name");
    expect(error.message).toContain("pageOrder");
    expect(error.message).not.toContain("Rosa");
    expect(error.cause).toBeUndefined();
  });
});

describe("migrateSiteWith", () => {
  // A pretend history: format 1 had `theme` as a string, format 2 renamed `title` to `name`.
  const migrations: Record<number, SiteMigration> = {
    1: (site) => ({ ...site, formatVersion: 2, theme: { name: site.theme } }),
    2: ({ title, ...site }) => ({ ...site, formatVersion: 3, name: title }),
  };

  it("runs every step from the document's version to the current one, in order", () => {
    const migrated = migrateSiteWith(
      { formatVersion: 1, theme: "cupcake", title: "Rosa" },
      { migrations, currentVersion: 3 },
    );

    expect(migrated).toEqual({ formatVersion: 3, theme: { name: "cupcake" }, name: "Rosa" });
  });

  it("starts in the middle of the chain for newer documents", () => {
    const migrated = migrateSiteWith(
      { formatVersion: 2, theme: { name: "light" }, title: "Rosa" },
      { migrations, currentVersion: 3 },
    );

    expect(migrated).toEqual({ formatVersion: 3, theme: { name: "light" }, name: "Rosa" });
  });

  it("never changes the caller's document", () => {
    const raw = { formatVersion: 1, theme: "cupcake", nested: { title: "x" } };
    const mutating: SiteMigration = (site: RawSite) => {
      (site.nested as { title: string }).title = "changed";
      return { ...site, formatVersion: 2 };
    };

    migrateSiteWith(raw, { migrations: { 1: mutating }, currentVersion: 2 });

    expect(raw.nested.title).toBe("x");
  });

  it("returns a current document as it is, and rejects one that isn't JSON before migrating it", () => {
    const current = { formatVersion: 2, theme: "light" };
    expect(migrateSiteWith(current, { migrations, currentVersion: 2 })).toBe(current);

    const cyclic: Record<string, unknown> = { formatVersion: 1 };
    cyclic.self = cyclic;
    expect(
      formatError(() => migrateSiteWith(cyclic, { migrations, currentVersion: 2 })).message,
    ).toBe("The site is not JSON");
  });

  it("fails on a gap in the chain or a step that doesn't bump the version", () => {
    expect(
      formatError(() =>
        migrateSiteWith({ formatVersion: 1 }, { migrations: {}, currentVersion: 2 }),
      ).message,
    ).toBe("No migration from format 1");
    const stuck: SiteMigration = (site) => site;
    expect(
      formatError(() =>
        migrateSiteWith({ formatVersion: 1 }, { migrations: { 1: stuck }, currentVersion: 2 }),
      ).message,
    ).toBe("Migration from format 1 did not bump it");
    const bug = new TypeError("site.pages is undefined");
    const failing: SiteMigration = () => {
      throw bug;
    };
    const failed = formatError(() =>
      migrateSiteWith({ formatVersion: 1 }, { migrations: { 1: failing }, currentVersion: 2 }),
    );
    expect(failed.message).toBe("Migration from format 1 failed");
    // What the step threw stays, so a bug in it reads differently from a bad file.
    expect(failed.cause).toBe(bug);
  });
});

describe("migration 1 → 2: a Hero's image value", () => {
  /** The format 1 fixture with its Hero's props replaced by `props`. */
  function withHero(props: Record<string, unknown>) {
    const site = JSON.parse(JSON.stringify(v1Site)) as typeof v1Site;
    const page = Object.values(site.pages)[0];
    const hero = page?.doc.content[0];
    if (hero === undefined) throw new Error("no Hero in the fixture");
    hero.props = { id: "hero", title: "Baked fresh", ...props } as typeof hero.props;
    // A Hero inside a slot is found too.
    site.layout.footer.push({
      type: "Section",
      props: { id: "s", content: [{ type: "Hero", props: { id: "inner", ...props } }] },
    } as never);
    return site;
  }

  const heroes = (site: ReturnType<typeof migrateSite>) => {
    const page = site.pages[site.pageOrder[0] ?? site.homePageId];
    const inner = site.layout.footer.at(-1)?.props.content as { props: unknown }[] | undefined;
    return [page?.doc.content[0]?.props, inner?.[0]?.props];
  };

  it("turns a media id and its description into one image value", () => {
    const site = migrateSite(withHero({ image: "hero000000000000", imageDescription: "Our shop" }));

    for (const props of heroes(site)) {
      expect(props).toMatchObject({ image: { mediaId: "hero000000000000", alt: "Our shop" } });
      expect(props).not.toHaveProperty("imageDescription");
    }
  });

  it("keeps the image's own alt text when there was no description", () => {
    const site = migrateSite(withHero({ image: "hero000000000000", imageDescription: "" }));

    expect(heroes(site)[0]).toMatchObject({ image: { mediaId: "hero000000000000" } });
    expect(heroes(site)[0]).not.toHaveProperty("image.alt");
  });

  it("drops an empty image", () => {
    const site = migrateSite(withHero({ image: "", imageDescription: "Nothing" }));

    expect(heroes(site)[0]).not.toHaveProperty("image");
    expect(heroes(site)[0]).not.toHaveProperty("imageDescription");
  });

  it("keeps an image value, adding the description as its alt text if it had none", () => {
    const site = migrateSite(
      withHero({ image: { mediaId: "hero000000000000" }, imageDescription: "Our shop" }),
    );

    expect(heroes(site)[0]).toMatchObject({
      image: { mediaId: "hero000000000000", alt: "Our shop" },
    });
  });
});

describe("migrateSite with a malformed file (R14)", () => {
  /** A section nested `depth` times inside itself, built without recursion. */
  function nested(depth: number) {
    const top = { type: "Section", props: { id: "s0", content: [] as unknown[] } };
    let parent = top;
    for (let level = 1; level < depth; level++) {
      const child = { type: "Section", props: { id: `s${level}`, content: [] as unknown[] } };
      parent.props.content.push(child);
      parent = child;
    }
    return top;
  }
  const withContent = (
    site: typeof v7Site | typeof v15Site,
    content: unknown[],
    formatVersion: number,
  ) => ({
    ...site,
    formatVersion,
    pages: {
      ...site.pages,
      home000000000000: {
        ...site.pages.home000000000000,
        doc: { ...site.pages.home000000000000.doc, content },
      },
    },
  });

  it("refuses a site nested 100,000 levels deep as invalid, in any format, never a RangeError", () => {
    const deep = [nested(100_000)];

    for (const formatVersion of [SITE_FORMAT_VERSION, 1]) {
      const error = formatError(() => migrateSite(withContent(v7Site, deep, formatVersion)));
      expect(error.code).toBe("invalid");
    }
  });

  it("keeps what else went wrong as the cause of an invalid site", () => {
    // Code that throws while reading a file, here a key list that can't be read.
    const boom = new RangeError("boom");
    const unreadable = new Proxy(
      { formatVersion: SITE_FORMAT_VERSION },
      {
        ownKeys() {
          throw boom;
        },
      },
    );

    const error = formatError(() => migrateSite(unreadable));

    expect(error.code).toBe("invalid");
    expect(error.cause).toBe(boom);
  });

  it("opens a site nested as deeply as a page plausibly is", () => {
    const site = migrateSite(withContent(v15Site, [nested(40)], SITE_FORMAT_VERSION));

    expect(site.pages[site.homePageId]?.doc.content).toHaveLength(1);
  });

  it("refuses an invalid node inside a slot, at any depth", () => {
    const broken = { type: 5, props: null };
    const inSection = { type: "Section", props: { id: "s", content: [broken] } };
    const deeper = { type: "Section", props: { id: "t", content: [inSection] } };

    for (const content of [[inSection], [deeper]]) {
      const error = formatError(() =>
        migrateSite(withContent(v15Site, content, SITE_FORMAT_VERSION)),
      );
      expect(error.code).toBe("invalid");
    }
    // A plain list of values that aren't nodes is no slot: it stays the component's to check,
    // even when an item has a field called `type` (a social link's network, a plan's kind).
    const lists = [
      { type: "Faq", props: { id: "f", items: [{ id: "q1", question: "Open?" }] } },
      {
        type: "Plans",
        props: {
          id: "p",
          items: [
            { id: "a", type: "x" },
            { id: "b", type: 5 },
          ],
        },
      },
    ];
    expect(() => migrateSite(withContent(v15Site, lists, SITE_FORMAT_VERSION))).not.toThrow();
  });
});

// Down and up (standards §5): a site of the current format, taken back to an older one by hand-
// written inverses of each step, migrates up to the same site. The inverses only go where each
// step's input could be: format 6 had no style tokens in its theme, format 5 could have a Section's padding as a size, format 4 named a
// daisyUI theme, format 1 had Hero images as a media id with their alt text apart.

type Raw = Record<string, unknown> & { formatVersion: number };
const records = (value: unknown): Record<string, unknown>[] =>
  Array.isArray(value)
    ? value.filter(
        (each): each is Record<string, unknown> => typeof each === "object" && each !== null,
      )
    : [];

/** Calls `visit` for every node of a raw site: pages, Header and Footer, shared sections. */
function eachNode(site: Raw, visit: (node: Record<string, unknown>) => void): void {
  const walk = (nodes: unknown): void => {
    for (const node of records(nodes)) {
      // List items (an Faq's questions) are records too, but no nodes.
      if (typeof node.type !== "string" || typeof node.props !== "object" || node.props === null) {
        continue;
      }
      visit(node);
      for (const value of Object.values(node.props)) walk(value);
    }
  };
  for (const page of Object.values(site.pages as Record<string, { doc: { content: unknown } }>)) {
    walk(page.doc.content);
  }
  const layout = site.layout as { header: unknown; footer: unknown };
  walk(layout.header);
  walk(layout.footer);
  for (const entry of Object.values((site.sharedSections ?? {}) as Record<string, unknown>)) {
    walk([(entry as { section: unknown }).section]);
  }
}

const SIZES: Readonly<Record<string, string>> = { s: "small", m: "medium", l: "large" };

/** A box with the same top and bottom size and nothing else, as format 5 could store it. */
function paddingSize(box: unknown): unknown {
  if (typeof box !== "object" || box === null) return box;
  const { top, bottom, ...rest } = box as Record<string, unknown>;
  const size = typeof top === "string" ? SIZES[top] : undefined;
  return size !== undefined && top === bottom && Object.keys(rest).length === 0 ? size : box;
}

/** The layouts whose width format 10 writes, and that width (as `migrations.ts` has them). */
const LAYOUT_WIDTHS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  Hero: { centred: "medium", minimal: "narrow" },
  CallToAction: { split: "wide" },
  Faq: { columns: "wide" },
  Video: { split: "wide" },
  Map: { split: "wide" },
};

/** Each step's inverse, keyed by the version it goes down *to*. */
const DOWN: Readonly<Record<number, (site: Raw) => Raw>> = {
  // 20 → 19: a Footer had no columns; a Columns Footer showed the menu's links beside its text, as
  // its one column of Menu links does (the arbitrary sites' Footers are Centred, with none).
  19: (site) => ({ ...site, formatVersion: 19 }),
  // 19 → 18: a Header had no button of its own; one a site has is kept, as format 19 reads it, and
  // the menu as it is (the arbitrary sites have no split Header for format 19 to move a link from).
  18: (site) => ({ ...site, formatVersion: 18 }),
  // 18 → 17: Site Settings had no logo; a site with one keeps it, as format 18 reads it.
  17: (site) => ({ ...site, formatVersion: 17 }),
  // 17 → 16: a theme had no list of its own colours; a list with colours in it is kept, as format
  // 17 reads it.
  16: (site) => {
    const { ownColors, ...theme } = site.theme as { ownColors?: unknown[] };
    return Array.isArray(ownColors) && ownColors.length === 0
      ? { ...site, theme, formatVersion: 16 }
      : { ...site, formatVersion: 16 };
  },
  // 16 → 15: no text was marked as an example; a site with no mark is as format 15 had it.
  15: (site) => {
    eachNode(site, (node) => {
      delete (node.props as Record<string, unknown>).examples;
    });
    return { ...site, formatVersion: 15 };
  },
  // 15 → 14: no link went to a collection's list; a site with one keeps it, as format 15 reads it.
  14: (site) => ({ ...site, formatVersion: 14 }),
  // 14 → 13: no field was of kind `tags`; a Blog had no Tags, which format 14 gives it, last.
  13: (site) => {
    const collections = Object.fromEntries(
      Object.entries(site.collections as Record<string, { fields: { name: string }[] }>).map(
        ([id, collection]) => [
          id,
          { ...collection, fields: collection.fields.filter((field) => field.name !== "tags") },
        ],
      ),
    );
    return { ...site, collections, formatVersion: 13 };
  },
  // 13 → 12: no collections yet; a site that had none didn't say so.
  12: (site) => {
    const { collections, ...rest } = site;
    return Object.keys(collections as object).length === 0
      ? { ...rest, formatVersion: 12 }
      : { ...site, formatVersion: 12 };
  },
  // 12 → 11: destinations were in Site Settings, and every site's list was empty.
  11: (site) => {
    const settings = site.settings as Record<string, unknown>;
    return { ...site, settings: { ...settings, publish: { destinations: [] } }, formatVersion: 11 };
  },
  // 11 → 10: no theme had an accent font, nor a look a font; the generated sites' accent is their
  // headings', and their looks set none.
  10: (site) => {
    const theme = site.theme as { fonts: Record<string, unknown> };
    const { accent, ...fonts } = theme.fonts;
    return { ...site, theme: { ...theme, fonts }, formatVersion: 10 };
  },
  // 10 → 9: a Section had no content width, Full its Full width toggle; every layout its own.
  9: (site) => {
    eachNode(site, (node) => {
      const props = node.props as Record<string, unknown>;
      if (node.type === "Section") {
        if (props.contentWidth === "full") props.fullWidth = true;
        delete props.contentWidth;
      } else if (
        typeof props.variant === "string" &&
        LAYOUT_WIDTHS[node.type as string]?.[props.variant] === props.contentWidth
      ) {
        delete props.contentWidth;
      }
    });
    return { ...site, formatVersion: 9 };
  },
  // 9 → 8: no theme had looks; a site from before them had none.
  8: (site) => {
    const { looks, ...theme } = site.theme as Record<string, unknown>;
    return { ...site, theme, formatVersion: 8 };
  },
  // 8 → 7: every theme was a built-in one; the generated sites' themes are.
  7: (site) => ({ ...site, formatVersion: 7 }),
  // 7 → 6: the theme had no style tokens; sites looked as their defaults do.
  6: (site) => {
    const { headings, cards, images, sections, ...theme } = site.theme as Record<string, unknown>;
    return { ...site, theme, formatVersion: 6 };
  },
  // 6 → 5: a Section's padding with the same small, medium or large top and bottom was a size.
  5: (site) => {
    eachNode(site, (node) => {
      const props = node.props as Record<string, unknown>;
      if (node.type !== "Section" || props.padding === undefined) return;
      const devices = (props.padding as { $responsive?: Record<string, unknown> }).$responsive;
      if (devices === undefined) {
        props.padding = paddingSize(props.padding);
      } else {
        for (const [device, box] of Object.entries(devices)) devices[device] = paddingSize(box);
      }
    });
    return { ...site, formatVersion: 5 };
  },
  // 5 → 4: the theme was a daisyUI theme's name.
  4: (site) => ({
    ...site,
    theme: { name: (site.theme as { preset: string }).preset },
    formatVersion: 4,
  }),
  // 4 → 3: names were already unique, so nothing to undo.
  3: (site) => ({ ...site, formatVersion: 3 }),
  // 3 → 2: no shared sections yet; a site that had none didn't say so.
  2: (site) => {
    const { sharedSections, ...rest } = site;
    return Object.keys(sharedSections as object).length === 0
      ? { ...rest, formatVersion: 2 }
      : { ...site, formatVersion: 2 };
  },
  // 2 → 1: a Hero's image was its media id, its alt text a prop of its own.
  1: (site) => {
    for (const page of Object.values(site.pages as Record<string, { doc: { content: unknown } }>)) {
      for (const node of records(page.doc.content)) {
        const props = node.props as Record<string, unknown>;
        if (node.type !== "Hero") continue;
        const image = props.image as { mediaId: string; alt?: string } | undefined;
        props.image = image?.mediaId ?? "";
        if (image?.alt !== undefined) props.imageDescription = image.alt;
      }
    }
    return { ...site, formatVersion: 1 };
  },
};

/** `site` taken down to format `version`. */
function downTo(site: SiteDoc, version: number): Raw {
  let raw = JSON.parse(JSON.stringify(site)) as Raw;
  for (let to = SITE_FORMAT_VERSION - 1; to >= version; to--) {
    const step = DOWN[to];
    if (step === undefined) throw new Error(`No inverse to format ${to}`);
    raw = step(raw);
  }
  return raw;
}

/** Format 4 → 5: what it makes of a daisyUI theme name is what a format 5 site can have had. */
const themeTokens =
  MIGRATIONS[4] ??
  ((): never => {
    throw new Error("No migration from format 4");
  });

/** Paddings a Section can have: none, sizes format 5 had, boxes it had too. */
const sectionPadding = fc.constantFrom(
  undefined,
  { top: "m", bottom: "m" },
  { top: "xl", bottom: "xl" },
  { top: "s", right: "s", bottom: "s" },
  { $responsive: { desktop: { top: "l", bottom: "l" }, mobile: { top: "s", bottom: "s" } } },
  { $responsive: { desktop: {}, tablet: { top: "m", bottom: "m" } } },
);

/**
 * Sites a format 1 file could have become: a Hero in one of its layouts, a Section with padding at
 * Medium or Full, a daisyUI theme, shared sections or none.
 */
const migratableSite = fc
  .record({
    site: siteDocArbitrary,
    preset: fc.constantFrom(...Object.keys(FORMAT_5_DAISYUI_THEMES)),
    alt: fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: undefined }),
    withImage: fc.boolean(),
    padding: sectionPadding,
    width: fc.constantFrom("medium", "full"),
    heroLayout: fc.constantFrom(undefined, "split", "centred", "minimal"),
    shared: fc.boolean(),
    blog: fc.boolean(),
  })
  .map(({ site, preset, alt, withImage, padding, width, heroLayout, shared, blog }): SiteDoc => {
    const format5 = themeTokens({ formatVersion: 4, theme: { name: preset } });
    const theme = accentFonts({
      ...themeStyleTokens({ ...format5, formatVersion: 6 }),
      formatVersion: 10,
    }).theme as SiteDoc["theme"];
    const home = site.pages[site.homePageId];
    if (home === undefined) throw new Error("no home page");
    const hero = {
      type: "Hero",
      props: {
        id: "hero",
        title: "Welcome",
        ...(heroLayout === undefined ? {} : { variant: heroLayout }),
        ...(heroLayout === "centred" ? { contentWidth: "medium" } : {}),
        ...(heroLayout === "minimal" ? { contentWidth: "narrow" } : {}),
        ...(withImage
          ? { image: { mediaId: "photo", ...(alt === undefined ? {} : { alt }) } }
          : {}),
      },
    };
    const section = {
      type: "Section",
      props: {
        id: "band",
        contentWidth: width,
        ...(padding === undefined ? {} : { padding }),
        content: [],
      },
    };
    const content = [hero, section, ...home.doc.content];
    // Without its Blog, a site's posts are ordinary pages in the folder they were in.
    const pages = blog
      ? site.pages
      : Object.fromEntries(
          Object.entries(site.pages).map(([id, { collection, entry, ...page }]) => [id, page]),
        );
    return {
      ...site,
      // With the empty list of the person's own colours format 17 gives a theme (TC-1a): colours in
      // it can't go below format 5, where a theme was its preset's name, as its looks can't.
      theme: { ...theme, ownColors: [] },
      sharedSections: shared ? site.sharedSections : {},
      collections: blog ? site.collections : {},
      pages: { ...pages, [site.homePageId]: { ...home, doc: { ...home.doc, content } } },
    };
  });

describe("migrations, down and up (standards §5)", () => {
  // 200 generated sites take under a second alone, but over 5 s on a busy machine (once, in a
  // full pnpm check): a timeout of its own, as the storage tests have, so load can't fail it.
  it("brings a site taken down to any older format back to the same site", () => {
    fc.assert(
      fc.property(
        migratableSite,
        fc.integer({ min: 1, max: SITE_FORMAT_VERSION }),
        (site, version) => {
          expect(migrateSite(downTo(site, version))).toEqual(site);
        },
      ),
      { numRuns: 200 },
    );
  }, 30_000);
});
