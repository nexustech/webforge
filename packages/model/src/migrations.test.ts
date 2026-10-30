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
const accentFonts =
  MIGRATIONS[9] ??
  ((): never => {
    throw new Error("No migration from format 9");
  });

/** Format 5 → 10, each step's own fixture tested below: what the later steps do to an older one. */
function latest(site: Record<string, unknown> & { formatVersion: 5 }): unknown {
  return accentFonts(
    componentLooks(
      ownThemes(themeStyleTokens(sectionPaddingBoxes(JSON.parse(JSON.stringify(site))))),
    ),
  );
}

/** A format 9 site as format 10 opens it: its accent font its headings' (3.22). */
const asLatest = (site: Record<string, unknown>) => accentFonts({ ...site, formatVersion: 9 });

/** The format 7 fixture as format 10 opens it: unchanged, its theme still a built-in one. */
const v7AsLatest = asLatest(v7Site);

describe("migrateSite", () => {
  it("opens the format 10 fixture unchanged, its accent font and a look that takes it (3.22)", () => {
    const site = migrateSite(v10Site);

    expect(site).toEqual(v10Site);
    expect(site.formatVersion).toBe(SITE_FORMAT_VERSION);
    expect(site.theme.fonts.accent).toEqual({ family: "Playfair Display", fallback: "serif" });
    expect(site.theme.looks?.CallToAction?.lookFont).toBe("accent");
  });

  it("opens the format 9 fixture as format 10, its accent font its headings' (3.22)", () => {
    const site = migrateSite(v9Site);

    expect(site).toEqual({
      ...v9Site,
      formatVersion: 10,
      theme: {
        ...v9Site.theme,
        fonts: { ...v9Site.theme.fonts, accent: v9Site.theme.fonts.heading },
      },
    });
    // A copy, not the same object: changing one font never changes the other.
    expect(site.theme.fonts.accent).not.toBe(site.theme.fonts.heading);
    // A theme that isn't a record, or has no fonts, is left for validation.
    expect(accentFonts({ formatVersion: 9, theme: "light" })).toEqual({
      formatVersion: 10,
      theme: "light",
    });
    expect(accentFonts({ formatVersion: 9, theme: { name: "x" } })).toEqual({
      formatVersion: 10,
      theme: { name: "x" },
    });
    expect(accentFonts({ formatVersion: 9, theme: { fonts: { body: "Inter" } } })).toEqual({
      formatVersion: 10,
      theme: { fonts: { body: "Inter" } },
    });
  });

  it("opens the format 9 fixture's looks for Buttons and Calls to action as they were (3.12)", () => {
    const site = migrateSite(v9Site);

    expect(site.theme.looks?.Button).toEqual({
      lookCorners: "full",
      lookShadow: { $responsive: { desktop: "medium", mobile: "none" } },
    });
  });

  it("opens the format 8 fixture as format 10, its theme without looks as it was (3.12)", () => {
    const site = migrateSite(v8Site);

    expect(site).toEqual(asLatest(v8Site));
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

  it("opens the format 7 fixture as format 10, its theme a built-in one as it was (2.23)", () => {
    const site = migrateSite(v7Site);

    expect(site).toEqual(v7AsLatest);
    expect(site.theme.own).toBeUndefined();
    expect(ownThemes({ formatVersion: 7, theme: "light" })).toEqual({
      formatVersion: 8,
      theme: "light",
    });
  });

  it("opens the format 6 fixture as format 10, its theme's style tokens as it looked (2.13d)", () => {
    const site = migrateSite(v6Site);

    expect(v6Site.theme).not.toHaveProperty("cards");
    expect(site).toEqual(v7AsLatest);
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

  it("opens the format 5 fixture as format 10, a Section's padding size as its top and bottom (R14)", () => {
    const site = migrateSite(v5Site);

    // The fixture's Sections have format 5's sizes, one plain, one per device.
    const section = v5Site.pages.home000000000000.doc.content.find(
      (node) => node.type === "Section",
    );
    expect(section?.props.padding).toBe("medium");
    expect(v5Site.sharedSections["shared-hours"].section.props.padding).toEqual({
      $responsive: { desktop: "large", mobile: "small" },
    });
    expect(site).toEqual(v7AsLatest);
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

  it("opens the format 4 fixture as format 10, its theme as tokens named after it (2.1)", () => {
    const site = migrateSite(v4Site);

    expect(site).toEqual(latest({ ...v4Site, formatVersion: 5, theme: cupcakeTokens }));
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

  it("opens the format 3 fixture as format 10, its shared sections' names made unique (3 → 4)", () => {
    const site = migrateSite(v3Site);

    // The fixture's second shared section repeats the first's name, as format 3 allowed.
    expect(v3Site.sharedSections["shared-hours-weekend"].name).toBe(" opening HOURS ");
    expect(site).toEqual(
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

  it("opens the format 2 fixture as format 10, with no shared sections yet", () => {
    expect(migrateSite(v2Site)).toEqual(
      latest({ ...v2Site, formatVersion: 5, sharedSections: {}, theme: cupcakeTokens }),
    );
  });

  it("opens the format 1 fixture as format 10, its Hero image one value with its alt text (1 → 2)", () => {
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
    site: typeof v7Site | typeof v10Site,
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
    const site = migrateSite(withContent(v10Site, [nested(40)], SITE_FORMAT_VERSION));

    expect(site.pages[site.homePageId]?.doc.content).toHaveLength(1);
  });

  it("refuses an invalid node inside a slot, at any depth", () => {
    const broken = { type: 5, props: null };
    const inSection = { type: "Section", props: { id: "s", content: [broken] } };
    const deeper = { type: "Section", props: { id: "t", content: [inSection] } };

    for (const content of [[inSection], [deeper]]) {
      const error = formatError(() =>
        migrateSite(withContent(v10Site, content, SITE_FORMAT_VERSION)),
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
    expect(() => migrateSite(withContent(v10Site, lists, SITE_FORMAT_VERSION))).not.toThrow();
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

/** Each step's inverse, keyed by the version it goes down *to*. */
const DOWN: Readonly<Record<number, (site: Raw) => Raw>> = {
  // 10 → 9: no theme had an accent font, nor a look a font; the generated sites' accent is their
  // headings', and their looks set none.
  9: (site) => {
    const theme = site.theme as { fonts: Record<string, unknown> };
    const { accent, ...fonts } = theme.fonts;
    return { ...site, theme: { ...theme, fonts }, formatVersion: 9 };
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
 * Sites a format 1 file could have become: a Hero, a Section with padding, a daisyUI theme, shared
 * sections or none.
 */
const migratableSite = fc
  .record({
    site: siteDocArbitrary,
    preset: fc.constantFrom(...Object.keys(FORMAT_5_DAISYUI_THEMES)),
    alt: fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: undefined }),
    withImage: fc.boolean(),
    padding: sectionPadding,
    shared: fc.boolean(),
  })
  .map(({ site, preset, alt, withImage, padding, shared }): SiteDoc => {
    const format5 = themeTokens({ formatVersion: 4, theme: { name: preset } });
    const theme = accentFonts({
      ...themeStyleTokens({ ...format5, formatVersion: 6 }),
      formatVersion: 9,
    }).theme as SiteDoc["theme"];
    const home = site.pages[site.homePageId];
    if (home === undefined) throw new Error("no home page");
    const hero = {
      type: "Hero",
      props: {
        id: "hero",
        title: "Welcome",
        ...(withImage
          ? { image: { mediaId: "photo", ...(alt === undefined ? {} : { alt }) } }
          : {}),
      },
    };
    const section = {
      type: "Section",
      props: { id: "band", ...(padding === undefined ? {} : { padding }), content: [] },
    };
    const content = [hero, section, ...home.doc.content];
    return {
      ...site,
      theme,
      sharedSections: shared ? site.sharedSections : {},
      pages: { ...site.pages, [site.homePageId]: { ...home, doc: { ...home.doc, content } } },
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
