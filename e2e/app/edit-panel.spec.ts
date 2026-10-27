import { type ElectronApplication, expect, type Page, test } from "@playwright/test";
import { clickOnCanvas } from "./canvas-click.js";
import { placeCaret } from "./caret.js";
import { launchDesktopApp, newUserDataDir, waitForCanvas } from "./launch.js";
import { chooseFromMenu } from "./menus.js";

// The Edit panel (1.14): the selected element's fields, each change one labelled undo step.

let app: ElectronApplication;
let page: Page;

test.beforeEach(async () => {
  app = await launchDesktopApp();
  page = await app.firstWindow();
  // Undo History is the left column's second tab, after Add.
  await page
    .getByRole("region", { name: "Left panels" })
    .getByRole("tab", { name: "Undo History" })
    .click();
  await waitForCanvas(page);
});

test.afterEach(async () => {
  await app.close();
});

const canvas = () => page.frameLocator(".editor__canvas iframe");
/** The editor's right-hand panels, where the Edit panel is (not Puck's own field UI). */
const panel = () => page.getByRole("region", { name: "Right panels" });
const steps = () => page.locator(".undo-history__step");
/** The Heading's own colour field, apart from the Appearance group's colours (2.22). */
const headingColour = () => panel().locator('[data-field="color"]');
/** A device view in the canvas toolbar (1.15). */
const deviceView = (name: "Desktop" | "Mobile") =>
  page.getByRole("toolbar", { name: "Canvas" }).getByRole("radio", { name });

/**
 * Selects the heading by clicking past the end of its text (clicking the text edits it), at its
 * bottom edge: once it is selected, its quick actions sit over its top edge, below the Header.
 */
async function selectHeading(): Promise<void> {
  const heading = canvas().locator(".site-heading");
  const box = await heading.boundingBox();
  if (box === null) throw new Error("Heading not visible");
  await clickOnCanvas(heading, { position: { x: box.width * 0.97, y: box.height - 2 } });
}

test.describe("Edit panel", () => {
  test("asks for a selection, then shows the selected element's fields", async () => {
    await expect(panel().getByText("Select an element to edit it")).toBeVisible();

    await selectHeading();

    await expect(panel().getByRole("heading", { name: "Heading", exact: true })).toBeVisible();
    await expect(panel().getByLabel("Text", { exact: true })).toHaveValue(
      "Welcome to our business",
    );
  });

  test("changes the heading's size as one step, on the canvas too", async () => {
    await selectHeading();
    await panel().getByRole("tab", { name: "Style" }).click();

    await panel().getByLabel("Size", { exact: true }).selectOption("small");

    await expect(steps().first()).toHaveText("Changed Heading size");
    await expect(canvas().locator("h3.site-heading")).toHaveText("Welcome to our business");
  });

  test("offers the theme's colours by their names, one step a choice (1.37, UX-25)", async () => {
    await selectHeading();
    await panel().getByRole("tab", { name: "Style" }).click();
    await expect(headingColour().getByRole("radio", { name: "Brand" })).toBeVisible();

    await headingColour().getByRole("radio", { name: "Second accent" }).click();

    await expect(steps().first()).toHaveText("Changed Heading colour");
    await expect(headingColour().getByRole("radio", { name: "Second accent" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  test("gives a heading a shade of the brand colour at an opacity, shown on the canvas (ADR 0009)", async () => {
    await selectHeading();
    await panel().getByRole("tab", { name: "Style" }).click();
    const heading = canvas().locator(".site-heading");
    const plain = await heading.evaluate((element) => getComputedStyle(element).color);

    await headingColour().getByRole("radio", { name: "Brand" }).click();
    await headingColour().getByRole("radio", { name: "Shade 300" }).click();
    await headingColour().getByLabel("Opacity").selectOption("80");

    await expect(heading).toHaveClass(/text-primary-300\/80/);
    await expect
      .poll(() => heading.evaluate((element) => getComputedStyle(element).color))
      .not.toBe(plain);
    await expect(steps().first()).toHaveText("Changed Heading colour");
  });

  test("copies a heading's style onto another heading, as one step (1.37, UX-14)", async () => {
    await selectHeading();
    await page.keyboard.press("ControlOrMeta+d");
    await expect(canvas().locator(".site-heading")).toHaveCount(2);
    // The copy is selected: make it small, and copy its style.
    await panel().getByRole("tab", { name: "Style" }).click();
    await panel().getByLabel("Size", { exact: true }).selectOption("small");
    await expect(canvas().locator("h3.site-heading")).toHaveCount(1);
    await page.keyboard.press("ControlOrMeta+Alt+c");

    // The first heading, still large, gets it from the Edit menu.
    const first = canvas().locator("h1.site-heading");
    const box = await first.boundingBox();
    if (box === null) throw new Error("Heading not visible");
    await clickOnCanvas(first, { position: { x: box.width * 0.97, y: box.height - 2 } });
    await chooseFromMenu(app, page, "Edit", "Paste Style");

    await expect(canvas().locator("h3.site-heading")).toHaveCount(2);
    await expect(steps().first()).toHaveText("Pasted style on Heading");
    await page.keyboard.press("ControlOrMeta+z");
    await expect(canvas().locator("h3.site-heading")).toHaveCount(1);
  });

  test("gives every heading on the page one heading's look, as one step (2.27, ST-4)", async () => {
    await selectHeading();
    await page.keyboard.press("ControlOrMeta+d");
    await expect(canvas().locator(".site-heading")).toHaveCount(2);
    // The copy is selected: give it a large shadow, and its look to the other heading.
    await panel().getByRole("tab", { name: "Style" }).click();
    await panel().getByLabel("Shadow", { exact: true }).selectOption("large");
    const shadowed = canvas().locator(".site-heading[class*='shadow-lg!']");
    await expect(shadowed).toHaveCount(1);
    await chooseFromMenu(app, page, "Edit", "Apply Look to Every Heading on This Page");

    await expect(shadowed).toHaveCount(2);
    await expect(steps().first()).toHaveText("Applied the Heading look to 1 other");
    await page.keyboard.press("ControlOrMeta+z");
    await expect(shadowed).toHaveCount(1);
  });

  test("makes one step of typing in a text field", async () => {
    await selectHeading();
    const field = panel().getByLabel("Text", { exact: true });

    await field.click();
    await placeCaret(field, "end");
    await page.keyboard.type(" today", { delay: 20 });
    await expect(canvas().locator(".site-heading")).toHaveText("Welcome to our business today");
    // Leaving the field ends the visit.
    await panel().getByRole("tab", { name: "Style" }).click();

    await expect(steps()).toHaveText(["Edited Heading text", "Opened page"]);
  });
});

test("undoes with Ctrl/Cmd+Z in a panel field through the site's history (ADR 0004)", async () => {
  await selectHeading();
  const field = panel().getByLabel("Text", { exact: true });
  await field.click();
  await placeCaret(field, "end");
  await page.keyboard.type("!", { delay: 20 });
  await expect(steps().first()).toHaveText("Edited Heading text");

  await page.keyboard.press("ControlOrMeta+z");

  await expect(field).toHaveValue("Welcome to our business");
  await expect(canvas().locator(".site-heading")).toHaveText("Welcome to our business");
  await expect(page.locator('.undo-history__step[aria-current="step"]')).toHaveText("Opened page");
});

/**
 * Selects the first Section by clicking its bottom padding, once the canvas has finished resizing
 * to the device view (Puck animates it).
 */
async function selectSection(): Promise<void> {
  const section = canvas().locator(".site-section");
  let last = "";
  await expect
    .poll(async () => {
      const box = JSON.stringify(await section.boundingBox());
      const settled = box === last;
      last = box;
      return settled;
    })
    .toBe(true);
  const box = await section.boundingBox();
  if (box === null) throw new Error("Section not visible");
  // Inside its bottom padding (32 px or more), clear of the edge: at a small zoom 4 px is a pixel.
  await section.click({ force: true, position: { x: 10, y: box.height - 16 } });
  await expect(panel().getByRole("heading", { name: "Section", exact: true })).toBeVisible();
}

test("sets a padding for the Mobile view only, shown and cleared with its dot (F-ED-4, UX-19)", async () => {
  const section = canvas().locator(".site-section");
  await deviceView("Mobile").click();
  await selectSection();

  // A new site's Section has Medium padding above and below, so each side has its own row (1.32).
  const top = panel().getByRole("radiogroup", { name: "Padding Top" });
  await top.getByRole("radio", { name: "S", exact: true }).click();

  await expect(steps().first()).toHaveText("Changed Section padding on Mobile");
  const dot = panel().getByRole("button", { name: /^Padding: set for Mobile only/ });
  await expect(dot).toBeVisible();
  await expect(section).toHaveClass(/(^| )px-4 pt-8 pb-16 md:py-16( |$)/);

  // The canvas toolbar keeps the selection when the view changes (U3): the panel shows Desktop's.
  await deviceView("Desktop").click();
  await expect(panel().getByRole("heading", { name: "Section", exact: true })).toBeVisible();
  await expect(panel().locator("[data-device-dot]")).toHaveCount(0);
  await expect(top.getByRole("radio", { name: "M", exact: true })).toHaveAttribute(
    "aria-checked",
    "true",
  );

  // Another mode re-renders the canvas: the view stays, rather than one picked for the window.
  await deviceView("Mobile").click();
  await page.getByRole("radio", { name: "Content", exact: true }).click();
  await expect(deviceView("Mobile")).toHaveAttribute("aria-checked", "true");
  await expect(section).toHaveCSS("padding-top", "32px");

  // The accent dot clears Mobile's own value, as one step: the dot turns grey.
  await page.getByRole("radio", { name: "Design", exact: true }).click();
  await selectSection();
  await dot.click();
  await expect(steps().first()).toHaveText("Reset Section padding on Mobile");
  await expect(
    panel()
      .getByRole("img", { name: /^Padding: same as Desktop on Mobile/ })
      .first(),
  ).toBeVisible();
  await expect(section).toHaveCSS("padding-top", "64px");
});

test("reverses a section's colours, on the canvas too, as one step (2.4, F-DS-3)", async () => {
  const section = canvas().locator(".site-section");
  const colours = () =>
    section.evaluate((element) => {
      const style = getComputedStyle(element);
      return { background: style.backgroundColor, text: style.color };
    });
  const before = await colours();
  await selectSection();

  await panel().getByLabel("Colours", { exact: true }).selectOption("inverse");

  await expect(steps().first()).toHaveText("Changed Section colours");
  await expect(section).toHaveAttribute("data-theme", "wf_inverse");
  // The theme's reversed colours: a dark band on the light page, its text light.
  await expect.poll(async () => (await colours()).background).not.toBe(before.background);
  expect((await colours()).text).not.toBe(before.text);

  await page.keyboard.press("ControlOrMeta+z");
  await expect(section).not.toHaveAttribute("data-theme");
});

test("underlines a section's title from its Appearance group, as one step (2.22, ST-1)", async () => {
  const title = canvas().locator(".site-hero h1");
  const left = page.getByRole("region", { name: "Left panels" });
  // Added with nothing selected, a Hero goes at the end of the page, and is selected.
  await left.getByRole("tab", { name: "Add" }).click();
  await left.getByRole("button", { name: "Hero", exact: true }).click();
  await expect(title).toBeVisible();
  await panel().getByRole("tab", { name: "Style" }).click();
  await expect(panel().getByRole("button", { name: "Appearance", exact: true })).toHaveAttribute(
    "aria-expanded",
    "true",
  );

  await panel().getByRole("switch", { name: "Underline" }).click();

  await expect(title).toHaveClass(/(^| )underline!( |$)/);
  await expect
    .poll(() => title.evaluate((element) => getComputedStyle(element).textDecorationLine))
    .toBe("underline");
  await page
    .getByRole("region", { name: "Left panels" })
    .getByRole("tab", { name: "Undo History" })
    .click();
  await expect(steps().first()).toHaveText("Changed Hero underline");
  await page.keyboard.press("ControlOrMeta+z");
  await expect(title).not.toHaveClass(/underline!/);
});

test("remembers the option groups closed for a kind of element, after a restart (UX-13)", async () => {
  const userDataDir = newUserDataDir();
  const reopen = async () => {
    await app.close();
    app = await launchDesktopApp({ userDataDir });
    page = await app.firstWindow();
    await expect(canvas().locator("style[data-webforge-site-css]")).toHaveCount(1);
  };
  await reopen();
  await selectHeading();
  await panel().getByRole("tab", { name: "Style" }).click();
  const appearance = panel().getByRole("button", { name: "Appearance", exact: true });
  await appearance.click();
  await expect(appearance).toHaveAttribute("aria-expanded", "false");

  await reopen();
  await selectHeading();
  await panel().getByRole("tab", { name: "Style" }).click();
  await expect(panel().getByRole("button", { name: "Appearance", exact: true })).toHaveAttribute(
    "aria-expanded",
    "false",
  );
});
