import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { expect, type Page, test } from "@playwright/test";
import { readTemplates } from "@webforge/templates/node";
import { CHECK_TEMPLATES, TEMPLATES_DIR } from "./exported-site.js";

// Every template, exported as a site made from it starts and opened from disk (file://) in
// Chromium, Firefox and WebKit (and Edge on Windows) with the network blocked (3.10, X1, C8): no
// request leaves the computer, every file a page names is there, its fonts and photos load, its
// scripts run without an error, and its menu, lightbox and carousel work. "Page not found" is
// left out: its links start at the site's root, for a host to serve (F-ED-20).

/**
 * Scrolls `page` to its bottom a screen at a time, then waits until nothing is loading: a request
 * a page makes late, as something scrolls into view or on a timer, is caught on the page that made
 * it.
 */
async function scrollThrough(page: Page): Promise<void> {
  await page.evaluate(async () => {
    for (let top = 0; top < document.documentElement.scrollHeight; top += window.innerHeight) {
      window.scrollTo(0, top);
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
    window.scrollTo(0, document.documentElement.scrollHeight);
  });
  await page.waitForLoadState("networkidle");
}

/** What a page names: its links, stylesheets, scripts, pictures and their sources, resolved. */
function namedFiles(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const urls: string[] = [];
    const add = (value: string | null | undefined) => {
      if (value !== null && value !== undefined && value !== "") {
        urls.push(new URL(value, document.baseURI).href);
      }
    };
    for (const element of document.querySelectorAll<HTMLElement>("[href], [src], [srcset]")) {
      add(element.getAttribute("href"));
      add(element.getAttribute("src"));
      for (const candidate of (element.getAttribute("srcset") ?? "").split(",")) {
        add(candidate.trim().split(/\s+/)[0]);
      }
    }
    return urls;
  });
}

/** Whether `url`'s anchor, if it has one, is an element of the page at `file`. */
function anchorIn(file: string, anchor: string): boolean {
  const id = decodeURIComponent(anchor.slice(1));
  return new RegExp(`\\sid="${id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`).test(
    readFileSync(file, "utf8"),
  );
}

/**
 * Loads every picture at once, lazy ones too, and waits until each has loaded or failed. One with
 * no source yet, the lightbox's until a photo is opened, is left out.
 */
async function loadPictures(page: Page): Promise<string[]> {
  return page.evaluate(async () => {
    const images = [...document.images].filter(
      (image) => image.getAttribute("src") || image.getAttribute("srcset"),
    );
    for (const image of images) image.loading = "eager";
    await Promise.all(images.map((image) => image.decode().catch(() => undefined)));
    return images
      .filter((image) => !image.complete || image.naturalWidth === 0)
      .map((image) => image.currentSrc || image.src);
  });
}

test.skip(!CHECK_TEMPLATES, "Nothing the templates are made from has changed");

for (const { template } of readTemplates()) {
  test(`${template.id}: every page works from disk, with nothing fetched from elsewhere`, async ({
    page,
  }) => {
    const dir = join(TEMPLATES_DIR, template.id);
    const external: string[] = [];
    const errors: string[] = [];
    await page.context().route(/^(?!file:)/, async (route) => {
      external.push(route.request().url());
      await route.abort();
    });
    page.on("pageerror", (error) => errors.push(error.message));
    const pages = readdirSync(dir, { recursive: true, encoding: "utf8" })
      .map((path) => path.replaceAll("\\", "/"))
      .filter((path) => path.endsWith(".html") && path !== "404.html")
      .sort();
    expect(pages).toContain("index.html");

    for (const path of pages) {
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto(pathToFileURL(join(dir, path)).href);
      await page.waitForLoadState("load");
      await scrollThrough(page);
      expect(external, `${path}'s requests that left the computer`).toEqual([]);

      // Every file the page names is in the export, and every anchor it links to on its pages.
      for (const url of await namedFiles(page)) {
        if (!url.startsWith("file:")) continue;
        const { hash } = new URL(url);
        const file = fileURLToPath(url.replace(/[?#].*$/, ""));
        expect(existsSync(file), `${path} names ${url}`).toBe(true);
        if (hash !== "" && file.endsWith(".html")) {
          expect(anchorIn(file, hash), `${path} links to ${url}`).toBe(true);
        }
      }
      // Its fonts and photos load from the export folder.
      const fonts = await page.evaluate(async () => {
        await document.fonts.ready;
        return [...document.fonts].filter((font) => font.status === "error").map((f) => f.family);
      });
      expect(fonts, `${path}'s fonts that failed`).toEqual([]);
      expect(await loadPictures(page), `${path}'s photos that failed`).toEqual([]);

      // Its gallery opens a photo large, and Escape closes it (2.7a).
      const photos = page.locator("a[data-wf-lightbox-item]");
      if ((await photos.count()) > 0) {
        await photos.first().click();
        const viewer = page.getByRole("dialog", { name: "Image viewer" });
        await expect(viewer, `${path}'s lightbox`).toBeVisible();
        await page.keyboard.press("Escape");
        await expect(viewer).toBeHidden();
      }
      // Its carousel moves to the next slide (2.10).
      const carousel = page.locator("[data-wf-carousel]").first();
      if ((await carousel.count()) > 0) {
        await carousel.getByRole("button", { name: "Next slide" }).click();
        await expect(carousel.locator("[data-wf-carousel-status]")).toHaveText(/^2 of \d+$/);
      }

      // On a phone, the menu opens with its button and shows the pages (2.6).
      await page.setViewportSize({ width: 390, height: 844 });
      const menu = page.locator("details[data-wf-menu]");
      if ((await menu.count()) > 0) {
        await menu.locator(":scope > summary").click();
        await expect(menu, `${path}'s menu`).toHaveAttribute("open", "");
        await expect(
          page.getByRole("navigation", { name: "Main navigation" }).getByRole("link").first(),
        ).toBeVisible();
      }
    }

    expect(errors, "script errors").toEqual([]);
    expect(external, "requests that left the computer").toEqual([]);
  });
}
