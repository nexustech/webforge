import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { expect, type Page, test } from "@playwright/test";
import { HERO_OVERLAY_SITE_DIR } from "./exported-site.js";

// The Hero's Overlay (HH-3) on an exported site, opened from disk: over its picture at the strength
// and in the colour chosen, its text in the colour that suits it, and a Hero saved before at the
// Neutral 70% it always had.

/** A Hero's overlay as the browser draws it: its colour's alpha, and its text's colour. */
const drawn = (page: Page, at: number) =>
  page
    .locator(".site-hero")
    .nth(at)
    .evaluate((hero) => {
      const layer = hero.querySelector(":scope > div.absolute.inset-0");
      const copy = hero.querySelector(":scope > .hero-content");
      const background = layer === null ? "" : getComputedStyle(layer).backgroundColor;
      // The last number of the colour: its alpha, in rgba() or a colour function's "/ a".
      const alpha = /[,/]\s*([\d.]+)\)$/.exec(background)?.[1];
      return {
        alpha: alpha === undefined ? 1 : Number(alpha),
        text: copy === null ? "" : getComputedStyle(copy).color,
        body: getComputedStyle(document.body).color,
      };
    });

test("draws each Hero's Overlay at its strength, in its colour, with readable text", async ({
  page,
}) => {
  await page.goto(pathToFileURL(join(HERO_OVERLAY_SITE_DIR, "index.html")).href);

  // Medium in the page's colour: 40%, the text in the page's own colour.
  const chosen = await drawn(page, 0);
  expect(chosen.alpha).toBeCloseTo(0.4, 2);
  expect(chosen.text).toBe(chosen.body);

  // Saved before: the Neutral colour at 70%, the text in Neutral's content colour.
  const before = await drawn(page, 1);
  expect(before.alpha).toBeCloseTo(0.7, 2);
  expect(before.text).not.toBe(before.body);
});

test("sets a Hero's text at the bottom of its picture, inside its padding (HH-6)", async ({
  page,
}) => {
  await page.goto(pathToFileURL(join(HERO_OVERLAY_SITE_DIR, "index.html")).href);
  const middle = page.locator(".site-hero").nth(0);
  const bottom = page.locator(".site-hero").nth(2);

  const gap = async (hero: typeof middle) =>
    hero.evaluate((section) => {
      const copy = section.querySelector(":scope > .hero-content");
      if (copy === null) return { below: Number.NaN, above: Number.NaN, padding: Number.NaN };
      const outer = section.getBoundingClientRect();
      const inner = copy.getBoundingClientRect();
      return {
        below: outer.bottom - inner.bottom,
        above: inner.top - outer.top,
        padding: Number.parseFloat(getComputedStyle(section).paddingBottom),
      };
    });

  // In the middle: as much room above the text as below.
  const centred = await gap(middle);
  expect(Math.abs(centred.above - centred.below)).toBeLessThan(2);
  // At the bottom: the section's padding below it, and the rest of the picture above.
  const low = await gap(bottom);
  expect(low.below).toBeCloseTo(low.padding, 0);
  expect(low.above).toBeGreaterThan(low.below);
});
