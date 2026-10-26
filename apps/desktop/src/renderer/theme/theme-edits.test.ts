import { DEFAULT_THEME, type SiteDoc, themeIdSchema } from "@webforge/model";
import { contrastRatio, FONT_PAIRINGS, THEME_PRESETS, themePreset } from "@webforge/themes";
import { describe, expect, it, vi } from "vitest";
import { starterSite } from "../../shared/starter-site.js";
import { sessionWith } from "../testing/fixtures.js";
import { TOKEN_CONTROLS, tokenKey } from "./theme-controls.js";
import {
  createOwnTheme,
  renameOwnTheme,
  setBrandColours,
  setColor,
  setFont,
  setPairing,
  setPaletteColor,
  setTextSize,
  setTextStep,
  setToken,
  switchPreset,
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
        action: "Switch to the theme 'Bistro'?",
        confirm: "Switch Theme",
        affectedPages: pages,
      }),
    );
    expect(theme()).toEqual(bistro);
    expect(theme()).not.toBe(bistro);
    expect(labels()).toEqual(["Changed theme to 'Bistro'"]);
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

  it("asks before a colour, and changes nothing when refused or unchanged", async () => {
    const { session, labels, theme } = setUp();

    expect(await setColor(session, answering(false), "accent", BRAND)).toBe(false);
    const same = answering(true);
    expect(await setColor(session, same, "accent", theme().colors.accent)).toBe(false);

    expect(same.confirmSiteWide).not.toHaveBeenCalled();
    expect(labels()).toEqual([]);
  });

  it("sets the fonts one at a time or as a pairing, once asked, as one step each", async () => {
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

    expect(labels()).toEqual(["Changed fonts", "Changed fonts"]);
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

    const confirm = answering(true);
    await setPaletteColor(session, confirm, "inverse", "primary", BRAND);

    expect(confirm.confirmSiteWide).toHaveBeenCalledWith(
      expect.objectContaining({ action: "Change the Brand colour in reversed sections?" }),
    );
    expect(theme().inverse?.primary).toEqual(BRAND);
    // Its surface was the neutral colour, as such a theme shows reversed sections.
    expect(theme().inverse?.["base-100"]).toEqual(shown);
    session.history.undo();
    expect(theme().inverse).toBeUndefined();
  });

  it("uses colours from an image once asked, as one step, reversed sections following (PG-2)", async () => {
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

    expect(await setBrandColours(session, answering(false), proposal, "Logo.png")).toBe(false);
    expect(await setBrandColours(session, answering(true), proposal, "Logo.png")).toBe(true);

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

/** Asks for names, answering `name` (or cancelling, `undefined`); `askName` is what it was asked. */
function naming(name: string | undefined) {
  const askName = vi.fn(() => Promise.resolve(name));
  return { names: { askName }, askName };
}

describe("your own themes (2.22, PH2-17)", () => {
  it("asks for a name before the first change to a built-in theme, and saves the person's own", async () => {
    const { session, labels, theme } = setUp();
    const builtIn = JSON.stringify(THEME_PRESETS);
    const asks = naming("Light, warmer");

    expect(await setColor(session, asks, "primary", BRAND)).toBe(true);

    expect(asks.askName).toHaveBeenCalledWith({
      title: "Save your own version of 'Light'?",
      description: expect.stringContaining("Built-in themes stay as they are."),
      initial: "Light (my version)",
      confirm: "Save Theme",
    });
    expect(theme().colors.primary).toEqual(BRAND);
    expect(theme().own).toEqual({ id: expect.any(String), name: "Light, warmer" });
    expect(theme().preset).toBe("light");
    // One step: the change and the new theme together. The built-in themes are as they were.
    expect(labels()).toEqual(["Saved theme 'Light, warmer'"]);
    expect(JSON.stringify(THEME_PRESETS)).toBe(builtIn);
    expect(DEFAULT_THEME.own).toBeUndefined();

    // The person's own theme changes as any change does, without asking again.
    await setToken(session, asks, control("cards.style"), "raised");
    expect(asks.askName).toHaveBeenCalledTimes(1);
    expect(labels()).toEqual(["Saved theme 'Light, warmer'", "Changed card style"]);

    session.history.undo();
    session.history.undo();
    expect(theme().own).toBeUndefined();
    expect(theme().colors.primary).not.toEqual(BRAND);
  });

  it("changes nothing when the name is cancelled, or the change to every page refused", async () => {
    const { session, labels, theme } = setUp();

    expect(await setTextSize(session, naming(undefined), "h1", "6xl")).toBe(false);
    const refused = { ...naming("Mine"), siteWide: answering(false).siteWide };
    expect(await setColor(session, refused, "primary", BRAND)).toBe(false);
    // The name is asked first: a refusal after it still changes nothing.
    expect(refused.askName).toHaveBeenCalledTimes(1);

    expect(theme().own).toBeUndefined();
    expect(labels()).toEqual([]);
  });

  it("creates one from a built-in theme, the site's or one of the person's own", async () => {
    const { session, labels, theme } = setUp();
    const bistro = themePreset("bistro");
    if (bistro === undefined) throw new Error("no Bistro");

    expect(await createOwnTheme(session, answering(false), bistro, "Shop")).toBe(false);
    expect(await createOwnTheme(session, answering(true), bistro, "Shop")).toBe(true);

    expect(theme()).toEqual({ ...bistro, own: { id: expect.any(String), name: "Shop" } });
    expect(labels()).toEqual(["Created theme 'Shop'"]);
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
    expect(keep).toHaveBeenLastCalledWith(
      expect.objectContaining({ own: { id: own.id, name: "Corner shop" } }),
    );

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

    await switchPreset(session, naming("never asked"), mine);

    expect(theme()).toEqual(mine);
    expect(labels()).toEqual(["Changed theme to 'Night'"]);
  });
});
