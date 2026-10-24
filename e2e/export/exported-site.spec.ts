import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import AxeBuilder from "@axe-core/playwright";
import { type BrowserContext, expect, type Page, test } from "@playwright/test";
import { priceList } from "@webforge/test-utils";
import { exportedPageUrl } from "./exported-site.js";

// The exported fixture site, opened from disk (file://) in Chromium, Firefox and WebKit with the
// network blocked (X1, C8): it must look and work right without any server or external request.

let externalRequests: string[] = [];

async function blockNetwork(context: BrowserContext): Promise<void> {
  externalRequests = [];
  await context.route(/^(?!file:)/, async (route) => {
    externalRequests.push(route.request().url());
    await route.abort();
  });
}

/** The Header's navigation (the Footer's is another). */
const mainNavigation = (page: Page) => page.getByRole("navigation", { name: "Main navigation" });

/**
 * The menu on small screens and the dropdowns in it (2.6): each a <details>, whose <summary> opens
 * it and which is open or not. `name` is the summary's text.
 */
const disclosure = (page: Page, selector: string, name: string) => {
  const details = page
    .locator(selector)
    .filter({ has: page.locator("summary", { hasText: name }) });
  return { details, summary: details.locator(":scope > summary") };
};

/** The fixture's Carousel of customers' quotes (2.10), its strip and its buttons. */
const quotes = (page: Page) => {
  const carousel = page.getByRole("region", { name: "What customers say" });
  return {
    carousel,
    track: carousel.locator("[data-wf-carousel-track]"),
    button: (name: string) => carousel.getByRole("button", { name }),
    scrollLeft: () =>
      carousel.locator("[data-wf-carousel-track]").evaluate((track) => track.scrollLeft),
    /** How far the strip must scroll to show slide `index`. */
    slideAt: (index: number) =>
      carousel
        .locator("[data-wf-carousel-track]")
        .evaluate(
          (track, at) =>
            ((track.children[at] as HTMLElement | undefined)?.offsetLeft ?? 0) -
            ((track.children[0] as HTMLElement | undefined)?.offsetLeft ?? 0),
          index,
        ),
  };
};

async function open(page: Page, name: string): Promise<void> {
  await blockNetwork(page.context());
  await page.goto(exportedPageUrl(name));
  await page.waitForLoadState("load");
}

test.afterEach(() => {
  expect(externalRequests, "requests that left the computer").toEqual([]);
});

test.describe("exported site from disk", () => {
  test("links to the price list, copied byte for byte, in a new tab (1.28)", async ({ page }) => {
    await open(page, "about.html");

    const link = page.getByRole("link", { name: "Price list (PDF)" });
    await expect(link).toHaveAttribute("target", "_blank");
    // The browser resolves the link from the page on disk to the exported file.
    const url = await link.evaluate((anchor: HTMLAnchorElement) => anchor.href);
    expect(url).toMatch(/^file:.*\/files\/price-list\.pdf$/);
    expect([...readFileSync(fileURLToPath(url))]).toEqual([...priceList()]);
  });

  test("loads its styles, fonts, image and script from the export folder", async ({ page }) => {
    await open(page, "index.html");

    await expect(page).toHaveTitle("Rosa's Bakery");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Baked fresh every morning");
    const loadedFonts = await page.evaluate(async () => {
      await document.fonts.ready;
      return [...document.fonts]
        .filter((font) => font.status === "loaded")
        .map((font) => `${font.family.replaceAll('"', "")} ${font.weight}`);
    });
    // Inter is a variable font (2.2): one file covers every weight.
    expect(loadedFonts).toContain("Inter 100 900");
    const image = page.getByRole("img", { name: "Green hills under a morning sun" });
    await expect(image).toHaveJSProperty("complete", true);
    expect(await image.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
    // daisyUI's theme reached the page: the primary button is not the browser default.
    const button = page.getByRole("main").getByRole("link", { name: "About us" }).last();
    expect(await button.evaluate((el) => getComputedStyle(el).backgroundColor)).not.toBe(
      "rgba(0, 0, 0, 0)",
    );
  });

  test("navigates between pages with relative links", async ({ page }) => {
    await open(page, "index.html");

    await mainNavigation(page).getByRole("link", { name: "About us" }).click();

    await expect(page).toHaveURL(/\/about\.html$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("About Rosa's Bakery");
    // Both menus mark the page you're on: the Header's and the Footer's.
    for (const name of ["Main navigation", "Footer navigation"]) {
      await expect(
        page.getByRole("navigation", { name }).getByRole("link", { name: "About us", exact: true }),
      ).toHaveAttribute("aria-current", "page");
    }
  });

  test("opens and closes the mobile menu with its button and Escape", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await open(page, "index.html");
    const menu = disclosure(page, "details[data-wf-menu]", "Menu");
    const home = mainNavigation(page).getByRole("link", { name: "Home" });

    await expect(home).toBeHidden();
    await menu.summary.click();
    await expect(menu.details).toHaveAttribute("open", "");
    await expect(home).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(menu.details).not.toHaveAttribute("open");
    await expect(home).toBeHidden();
    await expect(menu.summary).toBeFocused();
  });

  test("opens a dropdown in the mobile menu by keyboard; Escape closes it before the menu", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await open(page, "index.html");
    const menu = disclosure(page, "details[data-wf-menu]", "Menu");
    const dropdown = disclosure(
      page,
      "details[data-wf-menu] details[data-wf-dropdown]",
      "Visit us",
    );
    const questions = mainNavigation(page).getByRole("link", { name: "Questions" });

    await menu.summary.click();
    await expect(dropdown.details).not.toHaveAttribute("open");
    await expect(questions).toBeHidden();
    await dropdown.summary.focus();
    await page.keyboard.press("Enter");
    await expect(dropdown.details).toHaveAttribute("open", "");
    await expect(questions).toBeVisible();

    // Screen readers get the open menu and dropdown right too.
    const results = await new AxeBuilder({ page }).include("nav").analyze();
    expect(results.violations.map((violation) => `${violation.id}: ${violation.help}`)).toEqual([]);

    await page.keyboard.press("Escape");
    await expect(dropdown.details).not.toHaveAttribute("open");
    await expect(dropdown.summary).toBeFocused();
    await expect(menu.details).toHaveAttribute("open", "");
    await page.keyboard.press("Escape");
    await expect(menu.details).not.toHaveAttribute("open");
    await expect(menu.summary).toBeFocused();
  });

  test("shows the menu's dropdown, button and new-tab link on a wide screen", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await open(page, "index.html");
    const navigation = mainNavigation(page);
    const dropdown = disclosure(page, "nav > ul details[data-wf-dropdown]", "Visit us");

    await expect(navigation.getByRole("link", { name: "Order a cake" })).toHaveAttribute(
      "href",
      "about.html",
    );
    await dropdown.summary.click();
    await expect(navigation.getByRole("link", { name: "Find us" })).toHaveAttribute(
      "target",
      "_blank",
    );
    await expect(navigation.getByRole("link", { name: "Questions" })).toHaveAttribute(
      "href",
      "index.html#questions",
    );
    // A click elsewhere closes it.
    await page.getByRole("main").click({ position: { x: 5, y: 5 } });
    await expect(dropdown.details).not.toHaveAttribute("open");
    await expect(navigation.getByRole("link", { name: "Find us" })).toBeHidden();

    // So does focus moving on past it (by focus(): WebKit doesn't tab to links by default).
    await dropdown.summary.focus();
    await page.keyboard.press("Enter");
    await expect(dropdown.details).toHaveAttribute("open", "");
    await navigation.getByRole("link", { name: "Order a cake" }).focus();
    await expect(dropdown.details).not.toHaveAttribute("open");
  });

  test.describe("sticky header (F-DS-6)", () => {
    test("stays at the top, with its shadow once the page has scrolled past 80 px", async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1280, height: 600 });
      await open(page, "index.html");
      const header = page.locator("header.site-header");

      await expect(header).not.toHaveAttribute("data-scrolled");
      await page.mouse.wheel(0, 400);
      await expect(header).toHaveAttribute("data-scrolled", "");
      expect(Math.round((await header.boundingBox())?.y ?? -1)).toBe(0);
      await expect
        .poll(() => header.evaluate((element) => getComputedStyle(element).boxShadow))
        .not.toBe("none");
      await page.evaluate(() => window.scrollTo(0, 0));
      await expect(header).not.toHaveAttribute("data-scrolled");
    });

    test("keeps an anchor's section in view below it", async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 600 });
      await open(page, "index.html");
      const header = page.locator("header.site-header");

      await page.goto(`${exportedPageUrl("index.html")}#questions`);

      const height = (await header.boundingBox())?.height ?? 0;
      const target = page.locator("#questions");
      await expect
        .poll(async () => (await target.boundingBox())?.y ?? 0)
        .toBeGreaterThanOrEqual(height - 1);
    });
  });

  test.describe("carousel (2.10)", () => {
    test("names its slides and moves with its buttons and the arrow keys, round past the end", async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1280, height: 800 });
      await open(page, "index.html");
      const { carousel, track, button, scrollLeft } = quotes(page);
      // Stopped first, so only the buttons move it.
      await button("Stop the slides").click();
      await expect(button("Play the slides")).toBeVisible();

      // The slides, inside the strip (a group too, named "Slides").
      const slides = carousel.getByRole("group", { name: /^\d of 3$/ });
      await expect(slides).toHaveCount(3);
      await expect(slides.first()).toHaveAccessibleName("1 of 3");
      await button("Next slide").click();
      await expect(carousel.locator("[data-wf-carousel-status]")).toHaveText("2 of 3");
      await expect.poll(scrollLeft).toBeGreaterThan(0);
      await button("Previous slide").click();
      await button("Previous slide").click();
      await expect(carousel.locator("[data-wf-carousel-status]")).toHaveText("3 of 3");

      await track.focus();
      await page.keyboard.press("ArrowRight");
      await expect(carousel.locator("[data-wf-carousel-status]")).toHaveText("1 of 3");
      await expect.poll(scrollLeft).toBe(0);
    });

    test("plays every 5 seconds, its stop button first, and pauses while in use", async ({
      page,
    }) => {
      await page.clock.install();
      await open(page, "index.html");
      const { carousel, button, scrollLeft, slideAt } = quotes(page);
      const current = () => carousel.getAttribute("data-current");

      // The stop button comes before the slides and the other buttons (APG).
      await expect(carousel.getByRole("button").first()).toHaveAccessibleName("Stop the slides");
      await page.clock.runFor(5_000);
      await expect.poll(current).toBe("1");
      // Arrived, before the clock jumps on (its scrolling runs on real time).
      const second = await slideAt(1);
      await expect.poll(scrollLeft).toBe(second);

      await carousel.hover();
      await page.clock.runFor(10_000);
      expect(await current()).toBe("1");
      await page.mouse.move(0, 0);
      await button("Stop the slides").focus();
      await page.clock.runFor(10_000);
      expect(await current()).toBe("1");
    });

    test("never plays for a visitor who prefers reduced motion", async ({ page }) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.clock.install();
      await open(page, "index.html");
      const { carousel, button } = quotes(page);

      await expect(button("Play the slides")).toBeVisible();
      await page.clock.runFor(20_000);
      expect(await carousel.getAttribute("data-current")).toBeNull();
    });
  });

  test.describe("without JavaScript", () => {
    test.use({ javaScriptEnabled: false });

    test("shows the carousel as a strip the keyboard scrolls, without buttons that do nothing", async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1280, height: 800 });
      await open(page, "index.html");
      const { carousel, track, scrollLeft } = quotes(page);

      await expect(carousel.getByRole("button")).toHaveCount(0);
      // Reached and scrolled by the keyboard alone: a named group in the tab order.
      await expect(track).toHaveAccessibleName("Slides");
      await expect(track).toHaveAttribute("tabindex", "0");
      await track.focus();
      await expect(track).toBeFocused();
      await page.keyboard.press("ArrowRight");
      await expect.poll(scrollLeft).toBeGreaterThan(0);
    });

    test("opens and closes the mobile menu with its button, a <details> (2.6)", async ({
      page,
    }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await open(page, "index.html");
      const menu = disclosure(page, "details[data-wf-menu]", "Menu");
      const home = mainNavigation(page).getByRole("link", { name: "Home" });

      await expect(home).toBeHidden();
      await menu.summary.click();
      await expect(home).toBeVisible();
      await menu.summary.click();
      await expect(home).toBeHidden();
    });

    test("opens a dropdown with its button, from the keyboard too", async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 800 });
      await open(page, "index.html");
      const dropdown = disclosure(page, "nav > ul details[data-wf-dropdown]", "Visit us");
      const questions = mainNavigation(page).getByRole("link", { name: "Questions" });

      await expect(questions).toBeHidden();
      await dropdown.summary.focus();
      await page.keyboard.press("Enter");
      await expect(questions).toBeVisible();
    });

    test("keeps the header at the top, and an anchor's section below it", async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 600 });
      await open(page, "index.html");
      const header = page.locator("header.site-header");

      await page.mouse.wheel(0, 400);
      await expect.poll(async () => Math.round((await header.boundingBox())?.y ?? -1)).toBe(0);
      await page.goto(`${exportedPageUrl("index.html")}#questions`);
      const height = (await header.boundingBox())?.height ?? 0;
      await expect
        .poll(async () => (await page.locator("#questions").boundingBox())?.y ?? 0)
        .toBeGreaterThanOrEqual(height - 1);
    });
  });

  test("opens an FAQ answer with the keyboard", async ({ page }) => {
    await open(page, "index.html");
    const question = page.getByText("When are you open?");
    const answer = page.getByText("Tuesday to Sunday, 7am to 3pm.");

    await expect(answer).toBeHidden();
    await question.focus();
    await page.keyboard.press("Enter");

    await expect(answer).toBeVisible();
  });

  for (const name of ["index.html", "about.html"]) {
    test(`has no serious accessibility violations on ${name}`, async ({ page }) => {
      await open(page, name);

      const results = await new AxeBuilder({ page }).analyze();
      const serious = results.violations.filter(
        (violation) => violation.impact === "serious" || violation.impact === "critical",
      );

      expect(serious.map((violation) => `${violation.id}: ${violation.help}`)).toEqual([]);
    });
  }
});
