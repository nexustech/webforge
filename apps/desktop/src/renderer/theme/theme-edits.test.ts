import type { SiteDoc } from "@webforge/model";
import { FONT_PAIRINGS, themePreset } from "@webforge/themes";
import { describe, expect, it, vi } from "vitest";
import { starterSite } from "../../shared/starter-site.js";
import { sessionWith } from "../testing/fixtures.js";
import { TOKEN_CONTROLS, tokenKey } from "./theme-controls.js";
import {
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

/** A site-wide confirmation that answers `answer`, and what it was asked. */
const answering = (answer: boolean) => ({
  confirmSiteWide: vi.fn(() => Promise.resolve(answer)),
});

const control = (key: string) => {
  const found = TOKEN_CONTROLS.find((each) => tokenKey(each) === key);
  if (found === undefined) throw new Error(`no token ${key}`);
  return found;
};

const BRAND = { l: 0.5, c: 0.2, h: 30 };

describe("the Theme tab's edits (2.3a)", () => {
  it("sets a token as one step named for its group, and none for the value it has", () => {
    const { session, labels, theme } = setUp();

    setToken(session, control("cards.style"), "raised");
    setToken(session, control("headings.case"), "uppercase");
    setToken(session, control("headings.case"), "uppercase");
    setToken(session, control("effects.depth"), false);

    expect(theme().cards.style).toBe("raised");
    expect(theme().headings.case).toBe("uppercase");
    expect(theme().effects.depth).toBe(false);
    expect(labels()).toEqual(["Changed card style", "Changed heading style", "Changed effects"]);
  });

  it("sets a text style's size as one step naming it", () => {
    const { session, labels, theme } = setUp();

    setTextSize(session, "h1", "6xl");

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

  it("sets a text style's size, weight and line height as one step naming it", () => {
    const { session, labels, theme } = setUp();

    setTextStep(session, "h2", { weight: 800, leading: "normal" });
    setTextStep(session, "h2", { weight: 800 });

    expect(theme().typeScale.h2).toEqual({ size: "3xl", weight: 800, leading: "normal" });
    expect(labels()).toEqual(["Changed text style for Heading 2"]);
  });

  it("sets either palette's colours on their own in Theme Studio (F-DS-7)", async () => {
    const { session, labels, theme } = setUp();
    const reversed = theme().inverse?.primary;

    await setPaletteColor(session, answering(true), "colors", "primary", BRAND);
    expect(theme().inverse?.primary).toEqual(reversed);
    await setPaletteColor(session, answering(true), "inverse", "info-content", BRAND);
    expect(theme().inverse?.["info-content"]).toEqual(BRAND);

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

  it("undoes them all back to the theme it started with", async () => {
    const { session, theme } = setUp();
    const start = theme();
    const bistro = themePreset("bistro");
    if (bistro === undefined) throw new Error("no Bistro");

    await switchPreset(session, undefined, bistro);
    await setColor(session, undefined, "primary", BRAND);
    setToken(session, control("sections.rhythm"), "alternating");
    setTextSize(session, "body", "base");
    while (session.history.undo()) {
      // Every step, back to the start.
    }

    expect(theme()).toEqual(start);
  });
});
