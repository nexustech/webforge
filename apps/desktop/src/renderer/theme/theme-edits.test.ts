import { DEFAULT_THEME, type SiteDoc, themeIdSchema } from "@webforge/model";
import { contrastRatio, FONT_PAIRINGS, THEME_PRESETS, themePreset } from "@webforge/themes";
import { describe, expect, it, vi } from "vitest";
import { starterSite } from "../../shared/starter-site.js";
import { sessionWith } from "../testing/fixtures.js";
import { TOKEN_CONTROLS, tokenKey } from "./theme-controls.js";
import {
  addOwnColor,
  createOwnTheme,
  deleteOwnColor,
  lookReach,
  ownColorUseCount,
  ownCopyName,
  renameOwnColor,
  renameOwnTheme,
  setBrandColours,
  setColor,
  setFont,
  setLook,
  setOwnColor,
  setPairing,
  setPaletteColor,
  setTextScale,
  setTextSize,
  setTextStep,
  setToken,
  switchPreset,
  textScaleOf,
  textScaleSizes,
} from "./theme-edits.js";

/** A session on the starter site, the labels of its steps, and its theme now. */
function setUp(site: SiteDoc = starterSite()) {
  const session = sessionWith(site);
  return {
    session,
    labels: () => session.history.entries().map((entry) => entry.label),
    theme: () => session.history.document.getState().theme,
  };
}

/** Asks with a site-wide confirmation that answers `answer`; `confirmSiteWide` is what it was asked. */
function answering(answer: boolean) {
  const confirmSiteWide = vi.fn(() => Promise.resolve(answer));
  return { siteWide: { confirmSiteWide }, confirmSiteWide };
}

const control = (key: string) => {
  const found = TOKEN_CONTROLS.find((each) => tokenKey(each) === key);
  if (found === undefined) throw new Error(`no token ${key}`);
  return found;
};

const BRAND = { l: 0.5, c: 0.2, h: 30 };

describe("the Theme tab's edits (2.3a)", () => {
  it("runs Version History's hook before a change that asks nothing, and not before one it asks about (4.6)", async () => {
    const { session, theme } = setUp();
    const order: string[] = [];
    const siteWide = {
      confirmSiteWide: vi.fn(async () => {
        order.push("asked");
        return true;
      }),
      beforeUnaskedChange: vi.fn(async () => {
        // The version holds the site before the change.
        order.push(`before, ${String(theme().cards.style)}`);
      }),
    };

    await setToken(session, { siteWide }, control("cards.style"), "raised");
    await setTextSize(session, { siteWide }, "h1", "6xl");
    // Another theme is asked about: the confirmed action's own hook runs instead.
    const bistro = themePreset("bistro");
    if (bistro === undefined) throw new Error("no Bistro");
    await switchPreset(session, { siteWide }, bistro);

    expect(siteWide.beforeUnaskedChange).toHaveBeenCalledWith({
      action: "Changed card style",
      confirm: "Changed card style",
      affectedPages: Object.keys(session.history.document.getState().pages).length,
    });
    expect(order).toEqual(["before, flat", "before, raised", "asked"]);
    expect(siteWide.beforeUnaskedChange).toHaveBeenCalledTimes(2);
  });

  it("sets a token as one step named for its group, and none for the value it has", async () => {
    const { session, labels, theme } = setUp();

    await setToken(session, undefined, control("cards.style"), "raised");
    await setToken(session, undefined, control("headings.case"), "uppercase");
    await setToken(session, undefined, control("headings.case"), "uppercase");
    await setToken(session, undefined, control("effects.depth"), false);

    expect(theme().cards.style).toBe("raised");
    expect(theme().headings.case).toBe("uppercase");
    expect(theme().effects.depth).toBe(false);
    expect(labels()).toEqual(["Changed card style", "Changed heading style", "Changed effects"]);
  });

  it("sets a text style's size as one step naming it", async () => {
    const { session, labels, theme } = setUp();

    await setTextSize(session, undefined, "h1", "6xl");

    expect(theme().typeScale.h1.size).toBe("6xl");
    expect(labels()).toEqual(["Changed text size for Heading 1"]);
  });

  it("sets every text style a size smaller or larger than its preset's as one step (LF-16)", async () => {
    const { session, labels, theme } = setUp();
    expect(textScaleOf(theme())).toBe("standard");

    expect(await setTextScale(session, undefined, "smaller")).toBe(true);
    expect(theme().typeScale.h1.size).toBe("4xl");
    expect(theme().typeScale.body.size).toBe("base");
    expect(textScaleOf(theme())).toBe("smaller");
    // Already that size: no step.
    expect(await setTextScale(session, undefined, "smaller")).toBe(false);
    await setTextScale(session, undefined, "standard");

    expect(theme().typeScale).toEqual(DEFAULT_THEME.typeScale);
    expect(labels()).toEqual(["Changed text size", "Changed text size"]);
  });

  it("keeps the smallest and largest sizes at the ends, and reads a preset's own as standard (LF-16)", () => {
    const bistro = themePreset("bistro");
    if (bistro === undefined) throw new Error("no Bistro");
    expect(textScaleOf(bistro)).toBe("standard");
    // Bistro's main heading is the largest size already.
    expect(bistro.typeScale.h1.size).toBe("6xl");
    expect(textScaleSizes(bistro, "larger").h1).toBe("6xl");
    expect(textScaleSizes(DEFAULT_THEME, "smaller").h6).toBe("xs");
    // A preset no longer listed: the default theme's sizes are the standard ones.
    expect(textScaleOf({ ...DEFAULT_THEME, preset: "from-a-newer-webforge" })).toBe("standard");
    // One style sized on its own: none of the three.
    const h2 = { ...DEFAULT_THEME.typeScale.h2, size: "4xl" as const };
    expect(
      textScaleOf({ ...DEFAULT_THEME, typeScale: { ...DEFAULT_THEME.typeScale, h2 } }),
    ).toBeUndefined();
  });

  it("switches the preset once asked, with every page counted, as one step (D7)", async () => {
    const { session, labels, theme } = setUp();
    const bistro = themePreset("bistro");
    if (bistro === undefined) throw new Error("no Bistro");
    const pages = Object.keys(session.history.document.getState().pages).length;

    expect(await switchPreset(session, answering(false), bistro)).toBe(false);
    expect(labels()).toEqual([]);

    const confirm = answering(true);
    expect(await switchPreset(session, confirm, bistro)).toBe(true);
    expect(confirm.confirmSiteWide).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "Switch to the Theme 'Bistro'?",
        confirm: "Switch Theme",
        affectedPages: pages,
      }),
    );
    expect(theme()).toEqual(bistro);
    expect(theme()).not.toBe(bistro);
    expect(labels()).toEqual(["Changed theme to 'Bistro'"]);
  });

  it("keeps the person's own colours through a switch, adding those their own theme brings (TC-1a)", async () => {
    const sky = { id: "sky", name: "Sky", color: { l: 0.62, c: 0.14, h: 240 } };
    const moss = { id: "moss", name: "Moss", color: { l: 0.5, c: 0.1, h: 140 } };
    const site = starterSite();
    site.theme = { ...site.theme, ownColors: [sky] };
    const { session, theme } = setUp(site);
    const bistro = themePreset("bistro");
    if (bistro === undefined) throw new Error("no Bistro");

    // A built-in theme has none of its own: the site's stay.
    await switchPreset(session, answering(true), bistro);
    expect(theme()).toEqual({ ...bistro, ownColors: [sky] });

    // One of the person's own themes brings its colours, first; one of the same id is the theme's.
    const mine = { ...bistro, ownColors: [moss, { ...sky, name: "Sky blue" }] };
    await switchPreset(session, answering(true), mine);
    expect(theme().ownColors).toEqual([moss, { ...sky, name: "Sky blue" }]);
  });

  it("changes a brand colour in reversed sections too, at their lightness (#200)", async () => {
    const { session, labels, theme } = setUp();
    const before = theme();
    const reversed = before.inverse?.primary;

    expect(await setColor(session, answering(true), "primary", BRAND)).toBe(true);

    expect(theme().colors.primary).toEqual(BRAND);
    expect(theme().inverse?.primary).toEqual({ l: reversed?.l, c: BRAND.c, h: BRAND.h });
    expect(theme().inverse?.secondary).toEqual(before.inverse?.secondary);
    expect(labels()).toEqual(["Changed brand colour"]);
  });

  it("leaves reversed sections as they are for Surface and Text, and themes without them", async () => {
    const { session, theme } = setUp();
    const reversed = theme().inverse;

    await setColor(session, answering(true), "base-100", { l: 0.97, c: 0.01, h: 90 });
    await setColor(session, answering(true), "base-content", { l: 0.2, c: 0.01, h: 90 });
    expect(theme().inverse).toEqual(reversed);

    const site = starterSite();
    delete site.theme.inverse;
    const plain = setUp(site);
    await setColor(plain.session, answering(true), "secondary", BRAND);
    expect(plain.theme().inverse).toBeUndefined();
    expect(plain.labels()).toEqual(["Changed accent colour"]);
  });

  it("changes nothing for a colour it already has", async () => {
    const { session, labels, theme } = setUp();

    expect(await setColor(session, undefined, "accent", theme().colors.accent)).toBe(false);
    expect(labels()).toEqual([]);
  });

  it("sets the fonts one at a time or as a pairing, as one step each", async () => {
    const { session, labels, theme } = setUp();
    const classic = FONT_PAIRINGS.find((pairing) => pairing.id === "classic");
    if (classic === undefined) throw new Error("no Classic pairing");

    await setFont(session, answering(true), "heading", { family: "Lora", fallback: "serif" });
    expect(theme().fonts.heading).toEqual({ family: "Lora", fallback: "serif" });
    expect(theme().fonts.body.family).toBe("Inter");

    await setPairing(session, answering(true), classic);
    expect(theme().fonts.heading.family).toBe("Playfair Display");
    expect(theme().fonts.body.family).toBe("Source Sans 3");
    expect(await setPairing(session, answering(true), classic)).toBe(false);

    // The accent font (3.22) is set on its own, and a pairing keeps it.
    const said = toastsOf(session);
    await setFont(session, undefined, "accent", { family: "Pacifico", fallback: "sans-serif" });
    // Its toast says only the accent changed.
    expect(said).toEqual([expect.stringMatching(/^Accent font changed on \d+ pages?$/)]);
    expect(theme().fonts.accent).toEqual({ family: "Pacifico", fallback: "sans-serif" });
    expect(theme().fonts.heading.family).toBe("Playfair Display");
    const simple = FONT_PAIRINGS.find((pairing) => pairing.id === "simple");
    if (simple === undefined) throw new Error("no Simple pairing");
    await setPairing(session, answering(true), simple);
    expect(theme().fonts.accent.family).toBe("Pacifico");

    expect(labels()).toEqual(["Changed fonts", "Changed fonts", "Changed fonts", "Changed fonts"]);
  });

  it("moves an accent that is still the headings' font with them, and keeps one picked on its own (#644)", async () => {
    const { session, labels, theme } = setUp();
    const pairing = (id: string) => {
      const found = FONT_PAIRINGS.find((each) => each.id === id);
      if (found === undefined) throw new Error(`no ${id} pairing`);
      return found;
    };
    // The starter site's accent is a copy of its heading font, as format 11 and the themes give it.
    expect(theme().fonts.accent).toEqual(theme().fonts.heading);

    // A pairing, then a heading font: the accent goes with the headings each time, in their step.
    await setPairing(session, answering(true), pairing("classic"));
    expect(theme().fonts.accent).toEqual(theme().fonts.heading);
    await setFont(session, answering(true), "heading", { family: "Lora", fallback: "serif" });
    expect(theme().fonts.accent).toEqual({ family: "Lora", fallback: "serif" });
    expect(labels()).toEqual(["Changed fonts", "Changed fonts"]);
    session.history.undo();
    expect(theme().fonts.accent).toEqual(theme().fonts.heading);
    expect(theme().fonts.heading.family).toBe("Playfair Display");

    // Picked on its own, it stays through a heading font and a pairing.
    await setFont(session, answering(true), "accent", {
      family: "Pacifico",
      fallback: "sans-serif",
    });
    await setFont(session, answering(true), "heading", { family: "Lora", fallback: "serif" });
    await setPairing(session, answering(true), pairing("simple"));
    expect(theme().fonts.accent).toEqual({ family: "Pacifico", fallback: "sans-serif" });
    // The body text's font never moves it either.
    await setFont(session, answering(true), "body", { family: "Lora", fallback: "serif" });
    expect(theme().fonts.accent.family).toBe("Pacifico");
  });

  it("sets a text style's size, weight and line height as one step naming it", async () => {
    const { session, labels, theme } = setUp();

    await setTextStep(session, undefined, "h2", { weight: 800, leading: "normal" });
    await setTextStep(session, undefined, "h2", { weight: 800 });

    expect(theme().typeScale.h2).toEqual({ size: "3xl", weight: 800, leading: "normal" });
    expect(labels()).toEqual(["Changed text style for Heading 2"]);
  });

  it("sets the page's colours by the one rule, and reversed sections' on their own (F-DS-7)", async () => {
    const { session, labels, theme } = setUp();
    const reversed = theme().inverse?.primary;
    const page = theme().colors["info-content"];

    // A page brand colour in Theme Studio, as in the Theme tab: reversed sections take its hue.
    await setPaletteColor(session, answering(true), "colors", "primary", BRAND);
    expect(theme().inverse?.primary).toEqual({ l: reversed?.l, c: BRAND.c, h: BRAND.h });
    await setPaletteColor(session, answering(true), "inverse", "info-content", BRAND);
    expect(theme().inverse?.["info-content"]).toEqual(BRAND);
    expect(theme().colors["info-content"]).toEqual(page);

    expect(labels()).toEqual([
      "Changed Brand colour",
      "Changed Text on Information colour in reversed sections",
    ]);
  });

  it("gives a theme without reversed colours its own, from those it showed, once one changes", async () => {
    const site = starterSite();
    delete site.theme.inverse;
    const { session, theme } = setUp(site);
    const shown = theme().colors.neutral;

    await setPaletteColor(session, undefined, "inverse", "primary", BRAND);

    expect(theme().inverse?.primary).toEqual(BRAND);
    // Its surface was the neutral colour, as such a theme shows reversed sections.
    expect(theme().inverse?.["base-100"]).toEqual(shown);
    session.history.undo();
    expect(theme().inverse).toBeUndefined();
  });

  it("uses colours from an image at once, as one step, reversed sections following (PG-2)", async () => {
    const { session, labels, theme } = setUp();
    const before = theme();
    const proposal = {
      primary: BRAND,
      "primary-content": { l: 0.98, c: 0.02, h: 30 },
      secondary: { l: 0.45, c: 0.15, h: 250 },
      "secondary-content": { l: 0.98, c: 0.02, h: 250 },
      accent: { l: 0.5, c: 0.12, h: 150 },
      "accent-content": { l: 0.98, c: 0.02, h: 150 },
    };

    const said = toastsOf(session);
    const asks = answering(false);
    expect(await setBrandColours(session, asks, proposal, "Logo.png")).toBe(true);
    expect(asks.confirmSiteWide).not.toHaveBeenCalled();
    expect(said).toEqual([expect.stringMatching(/^Colours from 'Logo.png' used on \d+ pages?$/)]);

    expect(theme().colors.secondary).toEqual(proposal.secondary);
    expect(theme().colors["accent-content"]).toEqual(proposal["accent-content"]);
    // Reversed sections: the proposal's hues, fitted to their surface with their text (#462).
    const reversed = theme().inverse;
    const surface = reversed?.["base-100"] ?? BRAND;
    expect(reversed?.secondary.h).toBeCloseTo(proposal.secondary.h);
    expect(contrastRatio(reversed?.secondary ?? BRAND, surface)).toBeGreaterThanOrEqual(3);
    expect(
      contrastRatio(reversed?.["secondary-content"] ?? BRAND, reversed?.secondary ?? BRAND),
    ).toBeGreaterThanOrEqual(4.5);
    expect(reversed?.["base-100"]).toEqual(before.inverse?.["base-100"]);
    expect(theme().colors["base-100"]).toEqual(before.colors["base-100"]);
    expect(labels()).toEqual(["Changed brand colours from 'Logo.png'"]);
  });

  it("undoes them all back to the theme it started with", async () => {
    const { session, theme } = setUp();
    const start = theme();
    const bistro = themePreset("bistro");
    if (bistro === undefined) throw new Error("no Bistro");

    await switchPreset(session, undefined, bistro);
    await setColor(session, undefined, "primary", BRAND);
    await setToken(session, undefined, control("sections.rhythm"), "alternating");
    await setTextSize(session, undefined, "body", "base");
    while (session.history.undo()) {
      // Every step, back to the start.
    }

    expect(theme()).toEqual(start);
  });
});

/** Every key in `value`, at any depth: a replacer list that keeps all of them. */
function collectKeys(value: unknown): string[] {
  if (typeof value !== "object" || value === null) return [];
  return Object.entries(value).flatMap(([key, inner]) => [key, ...collectKeys(inner)]);
}

/**
 * My themes for a theme saved without asking (LF-15), listing themes named `taken`; `list` is what
 * it lists, as `{ id, name }`, for a test to add to, rename or delete from.
 */
function naming(...taken: string[]) {
  const list: { id: string; name: string }[] = taken.map((name, index) => ({
    id: `listed${index}`,
    name,
  }));
  const names = {
    taken: () => list.map((each) => each.name),
    nameOf: (id: string) => list.find((each) => each.id === id)?.name,
  };
  return { names, list };
}

/** The Undo toasts `session`'s steps ask for, in their own words (LF-15). */
function toastsOf(session: ReturnType<typeof setUp>["session"]): (string | boolean)[] {
  const said: (string | boolean)[] = [];
  session.onEntryAdded((_entry, _kind, announced) => {
    if (announced !== false) said.push(announced);
  });
  return said;
}

describe("your own themes (2.23, PH2-17)", () => {
  it("saves the person's own version of a built-in theme at its first change, without asking (LF-15)", async () => {
    const { session, labels, theme } = setUp();
    const builtIn = JSON.stringify(THEME_PRESETS);
    const asks = naming("Bistro (yours)");

    expect(await setColor(session, asks, "primary", BRAND)).toBe(true);

    expect(theme().colors.primary).toEqual(BRAND);
    expect(theme().own).toEqual({ id: expect.any(String), name: "Light (yours)" });
    expect(theme().preset).toBe("light");
    // One step, named for the change: the change and the new theme together. The built-in themes
    // are as they were.
    expect(labels()).toEqual(["Changed brand colour"]);
    expect(JSON.stringify(THEME_PRESETS)).toBe(builtIn);
    expect(DEFAULT_THEME.own).toBeUndefined();

    // The person's own theme changes as any change does, keeping its name.
    await setToken(session, asks, control("cards.style"), "raised");
    expect(theme().own?.name).toBe("Light (yours)");
    expect(labels()).toEqual(["Changed brand colour", "Changed card style"]);

    session.history.undo();
    session.history.undo();
    expect(theme().own).toBeUndefined();
    expect(theme().colors.primary).not.toEqual(BRAND);
  });

  it("saves the same version again after an undo, so trying colours keeps one theme (LF-15)", async () => {
    const { session, theme } = setUp();
    // My themes as the window keeps them: each saved theme is listed from then on.
    const asks = naming();

    await setColor(session, asks, "primary", BRAND);
    const first = theme().own;
    if (first !== undefined) asks.list.push({ ...first });
    session.history.undo();
    expect(theme().own).toBeUndefined();
    await setColor(session, asks, "primary", { l: 0.6, c: 0.1, h: 200 });

    // The same id and name, which My themes keeps in place: not "Light (yours, 2)".
    expect(theme().own).toEqual(first);
    expect(first?.name).toBe("Light (yours)");
    // Another opening of a site saves one of its own.
    const other = setUp();
    await setColor(other.session, asks, "primary", BRAND);
    expect(other.theme().own?.id).not.toBe(first?.id);
    expect(other.theme().own?.name).toBe("Light (yours, 2)");
  });

  it("saves a new version once the person deletes theirs, and keeps a name they gave it (LF-15)", async () => {
    const { session, theme } = setUp();
    const asks = naming();
    const tryColour = async (h: number) => {
      await setColor(session, asks, "primary", { l: 0.5, c: 0.2, h });
      const own = theme().own;
      if (own !== undefined && asks.list.every((each) => each.id !== own.id)) {
        asks.list.push({ ...own });
      }
      return own;
    };

    // Renamed in My themes meanwhile: the same one, by their name.
    const first = await tryColour(30);
    session.history.undo();
    const listed = asks.list.find((each) => each.id === first?.id);
    if (listed !== undefined) listed.name = "Cafe colours";
    expect(await tryColour(60)).toEqual({ id: first?.id, name: "Cafe colours" });

    // Deleted from My themes meanwhile: a new one, which My themes can list.
    session.history.undo();
    asks.list.splice(0);
    const fresh = await tryColour(90);
    expect(fresh?.id).not.toBe(first?.id);
    expect(fresh?.name).toBe("Light (yours)");
  });

  it("names the saved version after the theme, numbered when the person has that name (LF-15)", () => {
    expect(ownCopyName("Bistro", [])).toBe("Bistro (yours)");
    expect(ownCopyName("Bistro", ["Bistro (yours)", "Light (yours)"])).toBe("Bistro (yours, 2)");
    expect(ownCopyName("Bistro", ["Bistro (yours)", "Bistro (yours, 2)"])).toBe(
      "Bistro (yours, 3)",
    );
  });

  it("changes a colour or the fonts at once, its toast saying how far it reached (LF-15)", async () => {
    const { session, labels } = setUp();
    const said = toastsOf(session);
    const pages = Object.keys(session.history.document.getState().pages).length;
    const asks = answering(false);

    expect(await setColor(session, asks, "primary", BRAND)).toBe(true);
    expect(await setFont(session, asks, "heading", { family: "Lora", fallback: "serif" })).toBe(
      true,
    );
    expect(
      await setFont(session, asks, "accent", { family: "Inter", fallback: "sans-serif" }),
    ).toBe(true);
    expect(await setPaletteColor(session, asks, "inverse", "primary", BRAND)).toBe(true);

    // Nothing asked, even with a question that would refuse.
    expect(asks.confirmSiteWide).not.toHaveBeenCalled();
    expect(said).toEqual([
      `Brand colour changed on ${pages} pages`,
      `Fonts changed on ${pages} pages`,
      `Accent font changed on ${pages} pages`,
      `Brand colour changed in reversed sections on ${pages} pages`,
    ]);
    // One step each, named for what changed, which Undo reverses.
    expect(labels()).toEqual([
      "Changed brand colour",
      "Changed fonts",
      "Changed fonts",
      "Changed Brand colour in reversed sections",
    ]);
  });

  it("says 'Not changed' when another theme's question is cancelled, and nothing when answered (#614)", async () => {
    const { session, labels } = setUp();
    const notify = vi.fn();
    const bistro = themePreset("bistro");
    if (bistro === undefined) throw new Error("no Bistro");

    // As an Escape answers it.
    expect(await switchPreset(session, { ...answering(false), notify }, bistro)).toBe(false);
    expect(notify).toHaveBeenLastCalledWith("Not changed");
    expect(labels()).toEqual([]);

    // Answered, it changes and says nothing.
    expect(await switchPreset(session, { ...answering(true), notify }, bistro)).toBe(true);
    expect(notify).toHaveBeenCalledTimes(1);
  });

  it("creates one from a built-in theme, the site's or one of the person's own", async () => {
    const { session, labels, theme } = setUp();
    const bistro = themePreset("bistro");
    if (bistro === undefined) throw new Error("no Bistro");

    expect(await createOwnTheme(session, answering(false), bistro, "Shop")).toBe(false);
    expect(await createOwnTheme(session, answering(true), bistro, "Shop")).toBe(true);

    expect(theme()).toEqual({ ...bistro, own: { id: expect.any(String), name: "Shop" } });
    expect(labels()).toEqual(["Created theme 'Shop'"]);

    // From the site's theme as it is, nothing on the page changes: nothing to ask, whatever order
    // its tokens' keys are in (a theme's reversed colours are added last, #500 review).
    await setPaletteColor(session, undefined, "inverse", "info", BRAND);
    const reordered = JSON.parse(
      JSON.stringify(
        theme(),
        Object.keys(theme())
          .sort()
          .concat(...collectKeys(theme())),
      ),
    ) as typeof bistro;
    expect(Object.keys(reordered)).not.toEqual(Object.keys(theme()));
    const same = answering(false);
    expect(await createOwnTheme(session, same, reordered, "Shop, reordered")).toBe(true);
    expect(same.confirmSiteWide).not.toHaveBeenCalled();
    // From the site's theme as it is, nothing on the page changes: nothing to ask.
    const site = answering(false);
    expect(await createOwnTheme(session, site, theme(), "Shop, again")).toBe(true);
    expect(site.confirmSiteWide).not.toHaveBeenCalled();
    expect(theme().own?.name).toBe("Shop, again");
    expect(labels()).toEqual([
      "Created theme 'Shop'",
      "Changed Information colour in reversed sections",
      "Created theme 'Shop, reordered'",
      "Created theme 'Shop, again'",
    ]);
  });

  it("renames one: the site's theme in one step if it's that one, My themes either way", async () => {
    const { session, labels, theme } = setUp();
    await createOwnTheme(session, undefined, DEFAULT_THEME, "Shop");
    const own = theme().own;
    if (own === undefined) throw new Error("no own theme");
    const keep = vi.fn();

    renameOwnTheme(session, { ...theme(), own }, "Corner shop", keep);
    expect(theme().own?.name).toBe("Corner shop");
    expect(labels()).toEqual(["Created theme 'Shop'", "Renamed theme to 'Corner shop'"]);
    // The window keeps the site's theme as it changes (register-own-themes).
    expect(keep).not.toHaveBeenCalled();

    // Another of theirs: only My themes changes.
    const other = {
      ...DEFAULT_THEME,
      own: { id: themeIdSchema.parse("theme0000000000b"), name: "B" },
    };
    renameOwnTheme(session, other, "Bakery", keep);
    expect(labels()).toHaveLength(2);
    expect(keep).toHaveBeenLastCalledWith(
      expect.objectContaining({ own: { id: other.own.id, name: "Bakery" } }),
    );
  });

  it("switches to one of the person's own themes as one step named for it", async () => {
    const { session, labels, theme } = setUp();
    const mine = {
      ...DEFAULT_THEME,
      scheme: "dark" as const,
      own: { id: themeIdSchema.parse("theme0000000000c"), name: "Night" },
    };

    await switchPreset(session, naming(), mine);

    expect(theme()).toEqual(mine);
    expect(labels()).toEqual(["Changed theme to 'Night'"]);
  });
});

describe("the theme's looks (3.12, CT-1)", () => {
  /** The starter site with three Buttons: two on the home page, one with corners of its own, and one in the Footer. */
  function withButtons(): SiteDoc {
    const site = starterSite();
    const home = site.pages[site.homePageId];
    if (home === undefined) throw new Error("no home page");
    home.doc.content.push({
      type: "Section",
      props: {
        id: "band",
        content: [
          { type: "Button", props: { id: "plain", label: "Book" } },
          { type: "Button", props: { id: "own", label: "Call", lookCorners: "none" } },
        ],
      },
    });
    site.layout.footer.push({ type: "Button", props: { id: "foot", label: "Top" } });
    return site;
  }

  it("counts the elements of a kind that leave a field to its look, wherever they are", () => {
    const site = withButtons();

    expect(lookReach(site, "Button", ["lookCorners"])).toBe(2);
    expect(lookReach(site, "Button", ["lookCorners", "lookShadow"])).toBe(3);
    expect(lookReach(site, "Gallery", ["lookCorners"])).toBe(0);
  });

  it("sets a kind's look as one step, after asking how many it restyles (D7)", async () => {
    const { session, labels, theme } = setUp(withButtons());
    const { siteWide, confirmSiteWide } = answering(true);

    expect(await setLook(session, { siteWide }, "Button", "Button", { lookCorners: "full" })).toBe(
      true,
    );

    expect(theme().looks).toEqual({ Button: { lookCorners: "full" } });
    expect(labels()).toEqual(["Changed the theme's look for Button"]);
    expect(confirmSiteWide).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "Change How Every Button Looks?",
        description: "This restyles the 2 on the site that have no look of their own.",
      }),
    );
    session.history.undo();
    expect(theme().looks).toBeUndefined();
  });

  it("changes nothing when the question is cancelled, or the look has the value", async () => {
    const { session, labels, theme } = setUp(withButtons());

    expect(
      await setLook(session, answering(false), "Button", "Button", { lookCorners: "full" }),
    ).toBe(false);
    await setLook(session, undefined, "Button", "Button", { lookCorners: "full" });
    expect(await setLook(session, undefined, "Button", "Button", { lookCorners: "full" })).toBe(
      false,
    );

    expect(theme().looks).toEqual({ Button: { lookCorners: "full" } });
    expect(labels()).toEqual(["Changed the theme's look for Button"]);
  });

  it("changes nothing, and asks nothing, for a value the look has with its devices in another order (A18)", async () => {
    const { session, labels } = setUp(withButtons());
    await setLook(session, undefined, "Button", "Button", {
      lookCorners: { $responsive: { desktop: "full", mobile: "none" } },
    });
    const { siteWide, confirmSiteWide } = answering(true);

    expect(
      await setLook(session, { siteWide }, "Button", "Button", {
        lookCorners: { $responsive: { mobile: "none", desktop: "full" } },
      }),
    ).toBe(false);

    expect(confirmSiteWide).not.toHaveBeenCalled();
    expect(labels()).toEqual(["Changed the theme's look for Button"]);
  });

  it("takes a look off as a reset, leaving no empty look behind", async () => {
    const { session, labels, theme } = setUp(withButtons());
    await setLook(session, undefined, "Button", "Button", {
      lookCorners: "full",
      lookShadow: "large",
    });
    await setLook(session, undefined, "Heading", "Heading", { lookItalic: true });

    await setLook(session, undefined, "Button", "Button", {
      lookCorners: undefined,
      lookShadow: undefined,
    });
    expect(theme().looks).toEqual({ Heading: { lookItalic: true } });
    await setLook(session, undefined, "Heading", "Heading", { lookItalic: undefined });

    expect(theme().looks).toBeUndefined();
    expect(labels().slice(2)).toEqual([
      "Reset the theme's look for Button",
      "Reset the theme's look for Heading",
    ]);
  });
});

describe("your colours (TC-1b, #1218)", () => {
  const SKY = { l: 0.7, c: 0.12, h: 230 };
  const SEA = { l: 0.5, c: 0.1, h: 200 };
  /** A Section's background is a colour field; nothing else here is. */
  const isColorField = (type: string, field: string) =>
    type === "Section" && field === "lookBackground";
  /** The first Section's background on the home page. */
  const background = (session: ReturnType<typeof setUp>["session"]) => {
    const site = session.history.document.getState();
    const section = site.pages[site.homePageId]?.doc.content.find(
      (node) => node.type === "Section",
    );
    return section?.props.lookBackground;
  };
  /** Uses `id` on the first Section's background, at a shade and opacity. */
  const useOn = (session: ReturnType<typeof setUp>["session"], id: string) =>
    session.edit("props", "Used a colour", (draft) => {
      const section = draft.pages[draft.homePageId]?.doc.content.find(
        (node) => node.type === "Section",
      );
      if (section !== undefined) section.props.lookBackground = `own-${id}-300/50`;
    });

  it("adds, renames and changes a colour, each one step, and a rename changes no use", async () => {
    const { session, labels, theme } = setUp();
    const sky = await addOwnColor(session, undefined, "Sky", SKY);
    if (sky === undefined) throw new Error("not added");
    useOn(session, sky);
    expect(await renameOwnColor(session, undefined, sky, "Morning sky")).toBe(true);
    expect(await setOwnColor(session, undefined, sky, SEA)).toBe(true);
    expect(theme().ownColors).toEqual([{ id: sky, name: "Morning sky", color: SEA }]);
    expect(background(session)).toBe(`own-${sky}-300/50`);
    expect(labels()).toEqual([
      "Added colour 'Sky'",
      "Used a colour",
      "Renamed colour 'Sky' to 'Morning sky'",
      "Changed colour 'Morning sky'",
    ]);
    // Nothing changed: no step.
    expect(await renameOwnColor(session, undefined, sky, "Morning sky")).toBe(false);
  });

  it("deletes a colour in use, giving its uses to another, in one step that undoes as one", async () => {
    const { session, labels, theme } = setUp();
    const sky = await addOwnColor(session, undefined, "Sky", SKY);
    const sea = await addOwnColor(session, undefined, "Sea", SEA);
    if (sky === undefined || sea === undefined) throw new Error("not added");
    useOn(session, sky);
    expect(ownColorUseCount(session, sky, isColorField)).toBe(1);

    expect(
      await deleteOwnColor(session, undefined, sky, { kind: "replace", to: sea }, isColorField),
    ).toBe(true);
    expect(theme().ownColors?.map(({ id }) => id)).toEqual([sea]);
    expect(background(session)).toBe(`own-${sea}-300/50`);
    expect(labels().at(-1)).toBe("Deleted colour 'Sky'");

    session.history.undo();
    expect(theme().ownColors?.map(({ id }) => id)).toEqual([sky, sea]);
    expect(background(session)).toBe(`own-${sky}-300/50`);
  });

  it("deletes a colour in use, keeping each use as a one-off as it looks now", async () => {
    const { session, theme } = setUp();
    const sky = await addOwnColor(session, undefined, "Sky", SKY);
    if (sky === undefined) throw new Error("not added");
    useOn(session, sky);

    expect(await deleteOwnColor(session, undefined, sky, { kind: "oneOff" }, isColorField)).toBe(
      true,
    );
    expect(theme().ownColors).toEqual([]);
    // Its shade worked out as a hex colour of its own, its opacity kept: no reference left.
    expect(background(session)).toMatch(/^\[#[0-9a-f]{6}\]\/50$/);
    expect(ownColorUseCount(session, sky, isColorField)).toBe(0);
  });
});
