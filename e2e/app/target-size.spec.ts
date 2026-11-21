import { expect, type Page, test } from "@playwright/test";
import { launchDesktopApp, type WebforgeApp, waitForCanvas } from "./launch.js";
import { chooseFromMenu } from "./menus.js";

// Target size (F7, LF-18, #1181; WCAG 2.2 SC 2.5.8): at the default text size, no control the
// window shows is under 24 × 24 px, on the start screen, in the editor, Theme Studio and Settings.
// Inline links in sentences are exempt, as the criterion allows. The UX/UI review's measurement,
// kept as a test so it can't slip back.

let app: WebforgeApp;

test.afterEach(async () => {
  await app.close();
});

/**
 * The controls `page` shows that are under 24 px either way, as "role name (width × height)": every
 * button, link, field and control role in view, but an inline link in a sentence, and what is
 * drawn for screen readers only. The canvas's page is the person's site, so it isn't measured.
 * Measured once what is opening has finished: a dialog grows from 95% as it opens, which would
 * measure its 24 px controls as 23.
 */
const smallTargets = (page: Page) =>
  page.evaluate(async () => {
    // Each animation with an end (a spinner's has none).
    await Promise.all(
      document
        .getAnimations()
        .filter((animation) => animation.effect?.getComputedTiming().endTime !== Infinity)
        .map((animation) => animation.finished.catch(() => undefined)),
    );
    const CONTROLS = [
      "button",
      "a[href]",
      "input:not([type='hidden'])",
      "select",
      "textarea",
      "summary",
      ...[
        "button",
        "link",
        "tab",
        "menuitem",
        "menuitemcheckbox",
        "menuitemradio",
        "treeitem",
        "option",
        "radio",
        "checkbox",
        "switch",
        "slider",
        "combobox",
      ].map((role) => `[role='${role}']`),
    ].join(",");
    // Rounding: 24 px drawn at a fractional scale can measure 23.9.
    const MIN = 23.5;
    const view = { width: window.innerWidth, height: window.innerHeight };
    /** An inline link in a sentence: other text beside it in the same block. */
    const inSentence = (element: Element) => {
      if (element.tagName !== "A") return false;
      const block = element.parentElement?.closest("p, li, dd, td");
      return (block?.textContent ?? "").trim().length > (element.textContent ?? "").trim().length;
    };
    const small: string[] = [];
    for (const element of document.querySelectorAll<HTMLElement>(CONTROLS)) {
      if (!element.checkVisibility({ visibilityProperty: true, opacityProperty: true })) continue;
      if (element.closest("[aria-hidden='true'], .sr-only") !== null) continue;
      // A checkbox or radio button's label is its target too: a click on it checks the box.
      const labelled =
        element instanceof HTMLInputElement && ["checkbox", "radio"].includes(element.type)
          ? element.closest("label")
          : null;
      const box = (labelled ?? element).getBoundingClientRect();
      // Drawn for screen readers only, or wholly out of the window.
      if (box.width <= 1 || box.height <= 1) continue;
      if (box.right <= 0 || box.bottom <= 0 || box.left >= view.width || box.top >= view.height) {
        continue;
      }
      // A control inside another measured one (a row's own buttons are measured as themselves).
      if (box.width >= MIN && box.height >= MIN) continue;
      if (inSentence(element)) continue;
      const role = element.getAttribute("role") ?? element.tagName.toLowerCase();
      const name = (
        element.getAttribute("aria-label") ??
        element.textContent ??
        element.getAttribute("title") ??
        ""
      )
        .trim()
        .replace(/\s+/g, " ")
        .slice(0, 40);
      small.push(`${role} "${name}" (${Math.round(box.width)} × ${Math.round(box.height)})`);
    }
    return small;
  });

/**
 * The panels and lists of `page` that scroll sideways at their width, as "role name": none should
 * (#1181), so taller rows and wider buttons never push a panel's content out of it.
 */
const sidewaysScrolling = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>("body *")]
      .filter((element) => {
        if (!element.checkVisibility()) return false;
        const { overflowX } = getComputedStyle(element);
        return (
          (overflowX === "auto" || overflowX === "scroll") &&
          element.scrollWidth > element.clientWidth + 1
        );
      })
      .map(
        (element) =>
          `${element.getAttribute("role") ?? element.tagName.toLowerCase()} "${
            element.getAttribute("aria-label") ?? element.className.toString().slice(0, 40)
          }" scrolls sideways (${element.scrollWidth} in ${element.clientWidth})`,
      ),
  );

test("the start screen's controls are 24 px or more", async () => {
  app = await launchDesktopApp({ site: false });
  const start = await app.firstWindow();
  await start
    .getByRole("button", { name: /Start a Site/ })
    .first()
    .waitFor();
  expect(await smallTargets(start)).toEqual([]);
});

test("the editor's controls are 24 px or more, with an element selected and in each panel", async () => {
  app = await launchDesktopApp();
  const page = await app.firstWindow();
  await waitForCanvas(page);
  const found = new Set<string>();
  const measure = async (state: string) => {
    for (const small of await smallTargets(page)) found.add(`${state}: ${small}`);
    for (const sideways of await sidewaysScrolling(page)) found.add(`${state}: ${sideways}`);
  };
  await measure("opened");

  // The starter page's Heading selected: the Edit panel's Content and Style tabs, and Layers.
  const canvas = page.frameLocator(".editor__canvas iframe");
  await canvas.locator("h1").first().click();
  const right = page.getByRole("region", { name: "Right panels" });
  await expect(right.getByRole("heading", { name: "Heading", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await measure("Heading selected");
  await right.getByRole("tab", { name: "Style" }).click();
  await measure("Heading's Style tab");

  // Each left panel, and the right column's other tabs.
  const left = page.getByRole("region", { name: "Left panels" });
  for (const tab of await left.getByRole("tablist").first().getByRole("tab").all()) {
    await tab.click();
    await measure(`left: ${(await tab.getAttribute("aria-label")) ?? (await tab.textContent())}`);
  }
  for (const tab of await right.getByRole("tablist").first().getByRole("tab").all()) {
    await tab.click();
    await measure(`right: ${await tab.textContent()}`);
  }
  // Site Check, in the bottom panel.
  await page.getByRole("button", { name: "Show or Hide Bottom Panel" }).click();
  await measure("Site Check");

  // A menu of the menu bar, and the command box: their rows.
  await page.getByRole("menubar").getByRole("menuitem", { name: "Edit" }).click();
  await expect(page.getByRole("menu")).toBeVisible();
  await measure("Edit menu");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: /^Search commands/ }).click();
  await expect(page.getByRole("dialog", { name: "Commands" })).toBeVisible();
  await measure("Commands");
  await page.keyboard.press("Escape");

  expect([...found]).toEqual([]);
});

test("Theme Studio's and Settings' controls are 24 px or more", async () => {
  app = await launchDesktopApp();
  const page = await app.firstWindow();
  await waitForCanvas(page);

  await chooseFromMenu(app, page, "Site", "Theme Studio…");
  const studio = page.getByRole("dialog", { name: "Theme Studio" });
  await expect(studio).toBeVisible();
  const found = (await smallTargets(page)).map((small) => `Theme Studio: ${small}`);
  await page.keyboard.press("Escape");
  await expect(studio).toBeHidden();

  await page.keyboard.press("ControlOrMeta+,");
  await expect(page.getByRole("dialog", { name: "Settings" })).toBeVisible();
  found.push(...(await smallTargets(page)).map((small) => `Settings: ${small}`));

  expect(found).toEqual([]);
});
