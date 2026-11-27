import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, type ElectronApplication, expect, type Page, test } from "@playwright/test";
import { createSite, type NodeDoc } from "@webforge/model";
import { ProjectStore } from "@webforge/storage";
import {
  CARD_ROW_SECTIONS,
  cardRows,
  expectCardRows,
  type Measured,
  sameHeightTitle,
} from "../card-rows.js";
import { boxOf, drag } from "./drag.js";
import { sizeWindow } from "./fits.js";
import { launchDesktopApp, removeWhenFree, waitForCanvas } from "./launch.js";
import { openPreview } from "./sites.js";

// Cards in a row are the same height on the canvas as on the site (#1511): Features, Pricing,
// Team and Stats lay their cards out in CARD_ROWS, whose direct children are the cards on the
// site and Puck's wrappers on the canvas, which the canvas's own styles make the cards fill.
// Features' cards layout has Card height: Same height on every row (a grid from md), or Fit the
// text. The exported site's own spec checks every browser (export/card-rows.spec.ts).

let dir: string;
let app: ElectronApplication;
let page: Page;

/** Launches the app on a site whose home page holds `content`. */
async function start(content: readonly NodeDoc[]): Promise<void> {
  dir = mkdtempSync(join(tmpdir(), "webforge-card-heights-"));
  const sitePath = join(dir, "Cards.wforge");
  const site = createSite({
    name: "Cards",
    language: "en",
    homeTitle: "Home",
    notFoundTitle: "Not found",
  });
  site.pages[site.homePageId]?.doc.content.push(...structuredClone(content));
  const store = ProjectStore.create(sitePath, { name: "Cards" });
  store.saveSite(site);
  store.close();
  app = await launchDesktopApp({ args: [sitePath] });
  page = await app.firstWindow();
  await waitForCanvas(page);
  await sizeWindow(app, page, { width: 1366, height: 768 });
}

test.afterEach(async () => {
  await app.close();
  void removeWhenFree(dir);
});

const canvas = () => page.frameLocator(".editor__canvas iframe");

/** The address Preview opens in the default browser, caught instead. */
async function previewAddress(): Promise<string> {
  await app.evaluate(({ shell }) => {
    const opened: string[] = [];
    Object.assign(globalThis, { opened });
    Object.assign(shell, {
      openExternal: async (url: string) => {
        opened.push(url);
      },
    });
  });
  const opened = () =>
    app.evaluate(() => (globalThis as unknown as { opened: string[] }).opened.slice());
  await page.getByRole("banner").getByRole("button", { name: "Preview", exact: true }).click();
  await expect.poll(opened).toHaveLength(1);
  return (await opened())[0] ?? "";
}

test("draws each row of cards as Preview does, the same heights in the same rows (#1511)", async () => {
  await start(CARD_ROW_SECTIONS);
  // The canvas lays the page out at its Desktop width, which Preview is opened at too.
  const width = await canvas()
    .locator("body")
    .evaluate(() => window.innerWidth);
  await expect(canvas().locator(".site-feature").first()).toBeVisible();
  const onCanvas = await cardRows(canvas());
  expectCardRows(onCanvas, width, "the canvas");

  const browser = await chromium.launch();
  let inPreview: Measured;
  try {
    const site = await browser.newPage({ viewport: { width, height: 800 } });
    await openPreview(site, await previewAddress());
    inPreview = await cardRows(site);
  } finally {
    await browser.close();
  }
  expectCardRows(inPreview, width, "Preview");
  // The same heights, row for row. Not Pricing's: on the canvas each plan's button has the
  // canvas's own link editing under it, which makes every plan taller there alike.
  for (const [title, section] of Object.entries(onCanvas)) {
    if (title === "Prices") continue;
    expect
      .soft(
        section.rows.map((row) => row.heights),
        `${title}: the canvas's heights against Preview's`,
      )
      .toEqual(inPreview[title]?.rows.map((row) => row.heights));
  }
});

test("offers Card height for the cards layout only, and Fit the text draws each card its own height (#1511)", async () => {
  await start(CARD_ROW_SECTIONS.filter((section) => section.props.title === sameHeightTitle(4)));
  const left = page.getByRole("region", { name: "Left panels" });
  const right = page.getByRole("region", { name: "Right panels" });
  await left.getByRole("treeitem", { name: /^Features/ }).click();
  // With the section's layout, on the Edit panel's Style tab.
  await right.getByRole("tab", { name: "Style", exact: true }).click();
  const cardHeight = right.getByLabel("Card height", { exact: true });
  await expect(cardHeight).toHaveValue("same");

  await cardHeight.selectOption("fit");
  await left.getByRole("tab", { name: "Undo History", exact: true }).click();
  await expect(page.locator(".undo-history__step").first()).toHaveText(
    "Changed Features card height",
  );
  await expect
    .poll(async () => {
      const [row] = (await cardRows(canvas()))[sameHeightTitle(4)]?.rows ?? [];
      return Math.max(...(row?.heights ?? [0])) - Math.min(...(row?.heights ?? [0]));
    })
    .toBeGreaterThan(8);

  // No card box in the other layouts, so nothing to set.
  await right.getByLabel("Layout", { exact: true }).selectOption("centred");
  await expect(cardHeight).toHaveCount(0);
});

test("takes a card dropped before or after another in a row of cards laid out as a grid (#1511)", async () => {
  await start(CARD_ROW_SECTIONS.filter((section) => section.props.title === sameHeightTitle(4)));
  const card = (title: string) =>
    canvas()
      .locator(".site-feature")
      .filter({ has: canvas().getByText(title, { exact: true }) });
  const order = () =>
    canvas()
      .locator(".site-feature h3")
      .allTextContents()
      .then((titles) => titles.map((title) => title.trim()));
  await expect.poll(order).toEqual(["Card 1", "Card 2", "Card 3", "Card 4"]);

  // A point `across` and `down` Card 1, as fractions of its width and height, found before the
  // drag: once it starts, the canvas makes room for the card where it would land, which moves
  // Card 1, and a point found again would follow it. A row that wraps takes a drop both ways,
  // so from the row below, Card 1's top-left is before it and its bottom-right after.
  const onFirst = async (across: number, down: number) => {
    const box = await boxOf(card("Card 1"), "Card 1");
    return { x: box.x + box.width * across, y: box.y + box.height * down };
  };
  // Grabbed by its left padding, clear of its text, which would select words instead.
  // After the first card: Card 4, alone on the second row.
  await drag(page, card("Card 4"), await onFirst(0.85, 0.8), 0.02);
  await expect.poll(order).toEqual(["Card 1", "Card 4", "Card 2", "Card 3"]);
  // Before it: Card 3, now alone on the second row.
  await drag(page, card("Card 3"), await onFirst(0.15, 0.2), 0.02);
  await expect.poll(order).toEqual(["Card 3", "Card 1", "Card 4", "Card 2"]);
});
