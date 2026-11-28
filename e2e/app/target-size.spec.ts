import { expect, type Page, test } from "@playwright/test";
import { launchDesktopApp, type WebforgeApp, waitForCanvas } from "./launch.js";
import { chooseFromMenu } from "./menus.js";

// Target size (F7, LF-18, #1181; WCAG 2.2 SC 2.5.8): at the default text size, no control the
// window shows is under 24 × 24 px, on the start screen, in the editor, Style This…, Theme Studio,
// Settings and Publish. Inline links in sentences are exempt, as the criterion allows. A control
// shown only on hover is measured too, and must show on the keyboard's focus (#1454). The UX/UI
// review's measurement, kept as a test so it can't slip back.

let app: WebforgeApp;

test.afterEach(async () => {
  await app.close();
});

/** What the measurements count as a control: every button, link, field and control role. */
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

/**
 * The controls `page` shows that are under 24 px either way, as "role name (width × height)": every
 * control in view, transparent ones included (shown on hover), but an inline link in a sentence,
 * and what is drawn for screen readers only. The canvas's page is the person's site, so it isn't
 * measured. Measured once what is opening has finished: a dialog grows from 95% as it opens, which
 * would measure its 24 px controls as 23.
 */
const smallTargets = (page: Page) =>
  page.evaluate(async (controls) => {
    // Each animation with an end (a spinner's has none).
    await Promise.all(
      document
        .getAnimations()
        .filter((animation) => animation.effect?.getComputedTiming().endTime !== Infinity)
        .map((animation) => animation.finished.catch(() => undefined)),
    );
    // Rounding: 24 px drawn at a fractional scale can measure 23.9.
    const MIN = 23.5;
    const view = { width: window.innerWidth, height: window.innerHeight };
    /** An inline link in a sentence: other text beside it in the same block. */
    const inSentence = (element: Element) => {
      if (element.tagName !== "A") return false;
      const block = element.parentElement?.closest("p, li, dd, td");
      return (block?.textContent ?? "").trim().length > (element.textContent ?? "").trim().length;
    };
    /**
     * A button whose `::after` is stretched over its nearest positioned ancestor (a card's title,
     * #1014): a click anywhere on that ancestor is a click on it, so the ancestor is its target.
     * Only an ancestor with no other control in it, as a card is: one holding more (a panel whose
     * card forgot its `relative`) would let a small button pass by a box it doesn't own.
     */
    const stretchedOver = (element: HTMLElement) => {
      const after = getComputedStyle(element, "::after");
      const covers =
        after.content !== "none" &&
        after.position === "absolute" &&
        [after.top, after.right, after.bottom, after.left].every((side) => side === "0px");
      if (!covers || getComputedStyle(element).position !== "static") return null;
      const card = element.offsetParent;
      return card !== null && card.querySelectorAll(controls).length === 1 ? card : null;
    };
    const small: string[] = [];
    for (const element of document.querySelectorAll<HTMLElement>(controls)) {
      // Opacity isn't asked about: a control shown only while its row is hovered or focused is
      // transparent until then, but a target once shown (#1454). One that is transparent for good,
      // laid over what takes its clicks (a file input over its label), would need measuring by
      // what it covers instead; none is in the screens measured.
      if (!element.checkVisibility({ visibilityProperty: true })) continue;
      if (element.closest("[aria-hidden='true'], .sr-only") !== null) continue;
      // A checkbox or radio button's label is its target too: a click on it checks the box.
      const labelled =
        element instanceof HTMLInputElement && ["checkbox", "radio"].includes(element.type)
          ? element.closest("label")
          : null;
      const box = (labelled ?? stretchedOver(element) ?? element).getBoundingClientRect();
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
  }, CONTROLS);

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

/**
 * The controls of `page` that stay transparent while the keyboard's focus is on them, as "role
 * name": one shown only while its row is hovered or focused must show on focus too (WCAG 2.4.7), or
 * Tab lands on something no one can see (#1454). Each control the keyboard reaches that is
 * transparent is focused as Tab would focus it, then the focus goes back where it was.
 */
const hiddenWhenFocused = (page: Page) =>
  page.evaluate(async (controls) => {
    const settled = () =>
      Promise.all(
        document
          .getAnimations()
          .filter((animation) => animation.effect?.getComputedTiming().endTime !== Infinity)
          .map((animation) => animation.finished.catch(() => undefined)),
      );
    const before = document.activeElement;
    const hidden: string[] = [];
    for (const element of document.querySelectorAll<HTMLElement>(controls)) {
      if (element.tabIndex < 0 || element.matches(":disabled")) continue;
      if (element.closest("[aria-hidden='true'], .sr-only") !== null) continue;
      if (!element.checkVisibility({ visibilityProperty: true })) continue;
      if (element.checkVisibility({ opacityProperty: true })) continue;
      // As Tab would: shown as focused, which `focus()` alone may not be after a click.
      const asTab: FocusOptions & { focusVisible?: boolean } = { focusVisible: true };
      element.focus(asTab);
      await settled();
      if (!element.checkVisibility({ opacityProperty: true })) {
        const role = element.getAttribute("role") ?? element.tagName.toLowerCase();
        const name = (element.getAttribute("aria-label") ?? element.textContent ?? "")
          .trim()
          .replace(/\s+/g, " ")
          .slice(0, 40);
        hidden.push(`${role} "${name}"`);
      }
    }
    if (before instanceof HTMLElement) before.focus();
    return hidden;
  }, CONTROLS);

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
    for (const hidden of await hiddenWhenFocused(page)) found.add(`${state}: ${hidden} unseen`);
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
  // Style This…: its option groups' headers, with their Copy, Paste and Reset (#1454).
  await right.getByRole("button", { name: "Style This Heading…" }).click();
  const style = page.getByRole("dialog", { name: "Style this Heading" });
  await expect(style).toBeVisible();
  await measure("Style This Heading");
  await style.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(style).toHaveCount(0);

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

  // A menu of the menu bar, and the command box: their rows. macOS's menus are the system's.
  if (process.platform !== "darwin") {
    await page.getByRole("menubar").getByRole("menuitem", { name: "Edit" }).click();
    await expect(page.getByRole("menu")).toBeVisible();
    await measure("Edit menu");
    await page.keyboard.press("Escape");
  }
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
  const found: string[] = [];
  const measure = async (state: string) => {
    found.push(...(await smallTargets(page)).map((small) => `${state}: ${small}`));
    found.push(...(await hiddenWhenFocused(page)).map((hidden) => `${state}: ${hidden} unseen`));
  };
  await measure("Theme Studio");
  // Components: a kind's option groups, with their headers' buttons (#1454).
  await studio.getByRole("tab", { name: "Components" }).click();
  await expect(studio.getByRole("combobox", { name: "Sections and elements" })).toBeVisible();
  await measure("Theme Studio, Components");
  await page.keyboard.press("Escape");
  await expect(studio).toBeHidden();

  await page.keyboard.press("ControlOrMeta+,");
  await expect(page.getByRole("dialog", { name: "Settings" })).toBeVisible();
  await measure("Settings");

  expect(found).toEqual([]);
});

test("Publish's controls are 24 px or more, its first destination's cards whole (#1454)", async () => {
  app = await launchDesktopApp();
  const page = await app.firstWindow();
  await waitForCanvas(page);
  await page.getByRole("banner").getByRole("button", { name: "Publish", exact: true }).click();
  const publish = page.getByRole("dialog", { name: "Publish", exact: true });
  // With no destination yet, the kinds are cards, each one a button (#1014).
  const host = publish.getByRole("button", {
    name: "A web host with a control panel",
    exact: true,
  });
  await expect(host).toBeVisible();
  const found = (await smallTargets(page)).map((small) => `Publish: ${small}`);
  await host.click();
  await expect(page.getByRole("dialog", { name: "Publish to your web host" })).toBeVisible();
  found.push(...(await smallTargets(page)).map((small) => `web host: ${small}`));
  expect(found).toEqual([]);
});

test("the phone preview's cue is 24 px or more, with its words and as an icon (#1438)", async () => {
  app = await launchDesktopApp();
  const page = await app.firstWindow();
  await waitForCanvas(page);
  await chooseFromMenu(app, page, "File", "Preview on Phone…");
  const dialog = page.getByRole("dialog", { name: "Preview on your phone" });
  await expect(dialog.getByRole("img", { name: "QR code of the preview's address" })).toBeVisible({
    timeout: 15_000,
  });
  // The dialog's own Stop Phone Preview.
  const found = (await smallTargets(page)).map((small) => `dialog: ${small}`);
  // Its close button: Escape would first close the tooltip of Help, which has the focus.
  await dialog.getByRole("button", { name: "Close", exact: true }).first().click();
  await expect(dialog).toHaveCount(0);

  const banner = page.getByRole("banner");
  for (const [width, form] of [
    // As wide as the words need, and as wide as any E2E window (title-bar-menu.spec.ts).
    [1440, banner.getByRole("button", { name: "Stop Phone Preview" })],
    [960, banner.getByRole("button", { name: "Phone preview on" })],
  ] as const) {
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.unmaximize());
    await app.evaluate(
      ({ BrowserWindow }, size) => BrowserWindow.getAllWindows()[0]?.setContentSize(size, 800),
      width,
    );
    await expect(form).toBeVisible();
    found.push(...(await smallTargets(page)).map((small) => `${width} px: ${small}`));
  }
  expect(found).toEqual([]);
});
