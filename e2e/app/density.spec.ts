import { expect, type Page, test } from "@playwright/test";
import { launchDesktopApp, type WebforgeApp, waitForCanvas } from "./launch.js";

// The editor's one density (#1015, product owner 15 Nov 2026): 13 px working text, 12 px
// secondary text, nothing smaller, and a standard button at least 24 × 24 px (WCAG 2.2, 2.5.8),
// at the default Text size (Settings › Interface). The canvas's page is the site's, not measured.

let app: WebforgeApp | undefined;

test.afterEach(async () => {
  await app?.close();
  app = undefined;
});

/** The size of each visible piece of the window's text: an element's own, not its children's. */
const textSizes = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>("body *")]
      .filter((element) => {
        const own = [...element.childNodes].some(
          (node) => node.nodeType === Node.TEXT_NODE && (node.textContent ?? "").trim() !== "",
        );
        return own && element.checkVisibility() && element.getClientRects().length > 0;
      })
      .map((element) => ({
        text: (element.textContent ?? "").trim().slice(0, 40),
        size: Number.parseFloat(getComputedStyle(element).fontSize),
      })),
  );

/** The window's visible standard buttons (Button's `default` and `icon` sizes) and their sizes. */
const standardButtons = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('[data-slot="button"]')]
      .filter((button) => /(?:^|\s)(?:h-7|size-7)(?:\s|$)/.test(button.className))
      .filter((button) => button.checkVisibility())
      .map((button) => {
        const { width, height } = button.getBoundingClientRect();
        return { name: button.getAttribute("aria-label") ?? button.textContent, width, height };
      }),
  );

test("draws the editor's text at 12 px or more, 13 px for most, and its buttons at 24 px (#1015)", async () => {
  app = await launchDesktopApp();
  const page = await app.firstWindow();
  await waitForCanvas(page);

  const sizes = await textSizes(page);
  expect(sizes.length).toBeGreaterThan(20);
  expect(sizes.filter(({ size }) => size < 12)).toEqual([]);
  // The working size is the one most text is drawn at.
  const working = sizes.filter(({ size }) => size === 13).length;
  expect(working / sizes.length).toBeGreaterThan(0.5);

  const buttons = await standardButtons(page);
  expect(buttons.length).toBeGreaterThan(5);
  expect(buttons.filter(({ height }) => height < 24)).toEqual([]);
});
