import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type ElectronApplication, expect, type Page, test } from "@playwright/test";
import { expectWorkWithin, measureWork, OPEN_WAIT, openBudget } from "./budget.js";
import { canvasAxe } from "./canvas-axe.js";
import { placeCaret } from "./caret.js";
import {
  APP_START_TIMEOUT_MS,
  launchDesktopApp,
  removeWhenFree,
  type WebforgeApp,
  waitForCanvas,
} from "./launch.js";
import { chooseFromMenu, chooseFromSubmenu, submenuItems } from "./menus.js";
import { type RendererWindow, stubFileDialogs } from "./sites.js";

// The start screen (F-SITE-1, F-SITE-2): new → edit → quit → reopen from the Recent list.

// The Blank template's home page (2.15c).
const STARTER_HEADING = "Welcome";

let dir: string;
let userData: string;
let app: WebforgeApp | undefined;

test.beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "webforge-start-"));
  userData = join(dir, "user-data");
});

test.afterEach(async () => {
  await app?.close();
  app = undefined;
  void removeWhenFree(dir);
});

const canvas = (page: Page) => page.frameLocator(".editor__canvas iframe");

/**
 * How long File › Close Site may take to show the start screen: the last save, then the home
 * page's picture for the Recent list, each with its own timeout (5 s and 5 s).
 */
const CLOSE_SITE_WAIT = 15_000;

/** The running app; tests call it once they have launched one. */
function running(): ElectronApplication {
  if (app === undefined) throw new Error("The app is not running");
  return app;
}

async function startWithoutSite(): Promise<Page> {
  app = await launchDesktopApp({ userDataDir: userData, site: false });
  const page = await app.firstWindow();
  await expect(page.getByRole("heading", { name: "Get started" })).toBeVisible({
    timeout: APP_START_TIMEOUT_MS,
  });
  return page;
}

/** Closes the window as the user does, which saves and captures the Recent thumbnail. */
async function closeWindow(): Promise<void> {
  // Once it has closed, not once Electron has torn its process down, which can take a minute (#534).
  const closed = app?.untilClosed();
  await app?.evaluate(({ BrowserWindow }) => {
    BrowserWindow.getAllWindows()[0]?.close();
  });
  await closed;
  app = undefined;
}

test("opens Settings on the start screen, and File › Close Site goes back to it, saved (#1016)", async () => {
  const page = await startWithoutSite();
  // Its keys: Settings… is in File here, and in the app's menu on a Mac.
  await page.keyboard.press("ControlOrMeta+Comma");
  const settings = page.getByRole("dialog", { name: "Settings" });
  // AI apps too, to connect an app before any site exists (#1244).
  await expect(settings.getByRole("tab")).toHaveText([
    "Interface",
    "Devices",
    "Updates",
    "AI apps",
  ]);
  await settings.getByRole("button", { name: "Cancel" }).click();
  await expect(settings).toBeHidden();

  const sitePath = join(dir, "Rosa's Bakery.wforge");
  await stubFileDialogs(running(), sitePath);
  await page
    .getByRole("button", { name: "Choose a Template Yourself…", exact: true })
    .first()
    .click();
  const newSite = page.getByRole("dialog", { name: "New Site" });
  await newSite.getByRole("textbox", { name: "Site name" }).fill("Rosa's Bakery");
  await newSite.getByRole("button", { name: "Create" }).click();
  await waitForCanvas(page);

  await chooseFromMenu(running(), page, "File", "Close Site");
  // Saved, and its picture taken for the Recent list (#1175): up to a few seconds on a cold start.
  await expect(page.getByRole("heading", { name: "Get started" })).toBeVisible({
    timeout: CLOSE_SITE_WAIT,
  });
  // On the Recent list, and no longer the open one: it opens again from there.
  const card = page.getByRole("listitem").filter({ hasText: "Rosa's Bakery" });
  // A picture of its home page, taken as it closed (#1175).
  await expect(card.locator("img")).toHaveAttribute("src", /^data:image\/jpeg;base64,/);
  await card.getByRole("button").first().click();
  await waitForCanvas(page);
});

test("pictures the home page for the Recent list, not the editor with its selection (#1175)", async () => {
  const page = await startWithoutSite();
  await stubFileDialogs(running(), join(dir, "Rosa's Bakery.wforge"));
  await page
    .getByRole("button", { name: "Choose a Template Yourself…", exact: true })
    .first()
    .click();
  const newSite = page.getByRole("dialog", { name: "New Site" });
  await newSite.getByRole("textbox", { name: "Site name" }).fill("Rosa's Bakery");
  await newSite.getByRole("button", { name: "Create" }).click();
  await waitForCanvas(page);
  // A section selected, with its outline and grips on the canvas.
  await canvas(page).locator("h1").first().click();
  await expect(page.getByRole("navigation", { name: "Where the selection is" })).toBeVisible();

  await chooseFromMenu(running(), page, "File", "Close Site");
  // Saved, and its picture taken for the Recent list (#1175): up to a few seconds on a cold start.
  await expect(page.getByRole("heading", { name: "Get started" })).toBeVisible({
    timeout: CLOSE_SITE_WAIT,
  });
  // The home page drawn for its picture has gone again.
  await expect(page.locator("[data-site-picture]")).toHaveCount(0);
  const picture = page.getByRole("listitem").filter({ hasText: "Rosa's Bakery" }).locator("img");
  await expect(picture).toHaveAttribute("src", /^data:image\/jpeg;base64,/);
  // The home page's top 1280 × 800, as the export draws it: never the canvas, whose shape is the
  // window's, with the panels around it.
  const size = await picture.evaluate(async (image: HTMLImageElement) => {
    await image.decode();
    return { width: image.naturalWidth, height: image.naturalHeight };
  });
  expect(size.width).toBe(480);
  expect(Math.abs(size.height - 300)).toBeLessThanOrEqual(1);
  // Drawn, and with the site's CSS: more than one colour, and the Footer's band at the bottom of
  // the page as tall as the window, which only the site's CSS lays out (a blank or unstyled
  // capture has neither).
  const pixels = await picture.evaluate((image: HTMLImageElement) => {
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d");
    if (context === null) return undefined;
    context.drawImage(image, 0, 0);
    const at = (x: number, y: number) => [...context.getImageData(x, y, 1, 1).data.slice(0, 3)];
    const grid = new Set<string>();
    for (let x = 20; x < canvas.width; x += 40) {
      for (let y = 15; y < canvas.height; y += 30) grid.add(at(x, y).join(","));
    }
    return {
      colours: grid.size,
      page: at(canvas.width / 2, Math.round(canvas.height * 0.66)),
      footer: at(canvas.width / 2, canvas.height - 6),
    };
  });
  if (pixels === undefined) throw new Error("The picture can't be read");
  expect(pixels.colours).toBeGreaterThan(1);
  const apart = pixels.page.reduce(
    (sum, value, at) => sum + Math.abs(value - (pixels.footer[at] ?? 0)),
    0,
  );
  expect(apart).toBeGreaterThan(6);
});

test("creates a blank site, keeps an edit and reopens it from the Recent list", async () => {
  let page = await startWithoutSite();
  await expect(page.getByText("Sites you open or create appear here.")).toBeVisible();
  await expect(page).toHaveTitle("Webforge");

  // New Site, Blank: the save dialog (stubbed) names the file, and the editor opens on it.
  const sitePath = join(dir, "Rosa's Bakery.wforge");
  await stubFileDialogs(running(), sitePath);
  // The start screen's own (the welcome offers it too), not the title bar's New Site….
  await page
    .getByRole("button", { name: "Choose a Template Yourself…", exact: true })
    .first()
    .click();
  const newSite = page.getByRole("dialog", { name: "New Site" });
  await newSite.getByRole("textbox", { name: "Site name" }).fill("Rosa's Bakery");
  await newSite.getByRole("button", { name: "Create" }).click();
  await waitForCanvas(page);
  await expect(page.getByRole("banner").getByRole("status")).toHaveText("Saved");
  // The window's title names the site (#1016).
  await expect(page).toHaveTitle("Rosa's Bakery - Webforge");
  // The Blank template: Home, About and Contact, and its "Page not found" page.
  const blank = await page.evaluate(async () => {
    const read = await (window as unknown as RendererWindow).webforge.project.readSite();
    return read as { site: { pageOrder: string[] } };
  });
  expect(blank.site.pageOrder).toHaveLength(4);

  const heading = canvas(page).locator("h1 [contenteditable]");
  await heading.hover();
  await heading.click();
  await placeCaret(heading, "end");
  await page.keyboard.type(" today", { delay: 20 });
  await expect(canvas(page).locator("h1")).toHaveText(`${STARTER_HEADING} today`);
  await closeWindow();

  // Next launch: the start screen lists the site with its thumbnail and when it was edited.
  page = await startWithoutSite();
  const card = page.getByRole("listitem").filter({ hasText: "Rosa's Bakery" });
  await expect(card).toContainText("Edited");
  await expect(card).toContainText("Rosa's Bakery.wforge");
  await expect(card.locator("img")).toHaveAttribute("src", /^data:image\/jpeg;base64,/);

  await card.getByRole("button").first().click();
  await expect(canvas(page).locator("h1")).toHaveText(`${STARTER_HEADING} today`, {
    timeout: 30_000,
  });
});

test("makes a site from a template, named as typed and in the chosen theme, within its opening budget", async () => {
  const page = await startWithoutSite();
  await stubFileDialogs(running(), join(dir, "Rosa's Bakery.wforge"));

  // New Site (2.14a, F-SITE-1): the name, a template (which brings its theme), then another theme.
  // The start screen's own (the welcome offers it too), not the title bar's New Site….
  await page
    .getByRole("button", { name: "Choose a Template Yourself…", exact: true })
    .first()
    .click();
  const newSite = page.getByRole("dialog", { name: "New Site" });
  await newSite.getByRole("textbox", { name: "Site name" }).fill("Rosa's Bakery");
  await newSite.getByText("Café / Restaurant", { exact: true }).click();
  await expect(newSite.getByRole("radio", { name: "Bistro" })).toBeChecked();
  await newSite.getByText("Atelier", { exact: true }).click();

  const opened = await measureWork(running());
  await newSite.getByRole("button", { name: "Create" }).click();
  // Opening (F-SITE-1): the template's home page on the canvas. Nearly all of it is the editor
  // starting again on the new site, as for every site opened; the fill itself is quick. Checked
  // here by its CPU time and a wall-clock backstop; its 3 s by `pnpm e2e:perf` (ADR 0014).
  const hero = canvas(page).locator("h1", { hasText: "Good coffee and proper breakfasts" });
  await expect(hero).toBeVisible({ timeout: OPEN_WAIT });
  expectWorkWithin(await opened(), await openBudget(running()), "Opening the new Café site");
  // With its photo, which came into the site's Media.
  await expect(canvas(page).locator("section img").first()).toHaveJSProperty("complete", true);
  await expect(canvas(page).locator("section img").first()).not.toHaveJSProperty("naturalWidth", 0);

  const site = await page.evaluate(async () => {
    const read = await (window as unknown as RendererWindow).webforge.project.readSite();
    return read as {
      site: { settings: { general: { name: string } }; theme: { preset: string } };
    };
  });
  expect(site.site.settings.general.name).toBe("Rosa's Bakery");
  expect(site.site.theme.preset).toBe("atelier");
});

test("makes a Personal / CV site within its opening budget, accessible on the canvas (2.15c)", async () => {
  const page = await startWithoutSite();
  await stubFileDialogs(running(), join(dir, "Sam Lee.wforge"));

  await page
    .getByRole("button", { name: "Choose a Template Yourself…", exact: true })
    .first()
    .click();
  const newSite = page.getByRole("dialog", { name: "New Site" });
  await newSite.getByRole("textbox", { name: "Site name" }).fill("Sam Lee");
  await newSite.getByText("Personal / CV", { exact: true }).click();
  await expect(newSite.getByRole("radio", { name: "Studio" })).toBeChecked();

  const opened = await measureWork(running());
  await newSite.getByRole("button", { name: "Create" }).click();
  // The name typed, in place of the template's sample person (QS-2, 3.11a).
  const hero = canvas(page).locator("h1", { hasText: "Hello, I'm Sam Lee" });
  await expect(hero).toBeVisible({ timeout: OPEN_WAIT });
  expectWorkWithin(
    await opened(),
    await openBudget(running()),
    "Opening the new Personal / CV site",
  );
  await expect(canvas(page).locator("section img").first()).not.toHaveJSProperty("naturalWidth", 0);

  // The page as the canvas draws it, inside its frame, what the editor adds to it included (#465):
  // the frame's title and language, the inline editors' names and the elements' wrappers.
  const results = await canvasAxe(page);
  expect(
    results.violations.map(
      (violation) => `${violation.id}: ${violation.help} (${violation.targets.join(", ")})`,
    ),
  ).toEqual([]);
  // It checked the page: rules passed inside the frame.
  expect(results.passes).toBeGreaterThan(5);
});

test("tries the example: a pre-filled site named after it, within its opening budget (2.14b, PG-3)", async () => {
  const page = await startWithoutSite();
  await stubFileDialogs(running(), join(dir, "Café - Restaurant.wforge"));

  const opened = await measureWork(running());
  // Straight from the start screen: no New Site dialog, the example's own name and theme.
  // Exactly: the first start's welcome has a Try an example card too.
  await page.getByRole("button", { name: /^Try an Example/ }).click();
  // The first example the app ships: Café / Restaurant (Trades is the second).
  const hero = canvas(page).locator("h1", { hasText: "Good coffee and proper breakfasts" });
  await expect(hero).toBeVisible({ timeout: OPEN_WAIT });
  expectWorkWithin(await opened(), await openBudget(running()), "Opening the example");

  const site = await page.evaluate(async () => {
    const read = await (window as unknown as RendererWindow).webforge.project.readSite();
    return read as { site: { settings: { general: { name: string } }; pageOrder: string[] } };
  });
  expect(site.site.settings.general.name).toBe("Café / Restaurant");
  expect(site.site.pageOrder.length).toBeGreaterThan(1);
});

test("pins a site to the top of the Recent list, which it keeps after a restart (2.14b)", async () => {
  // Four launches, as in Open Recent's test below: two to make the sites, then the start screen
  // twice. It ran out of the one-launch time under load (#1147).
  test.slow();
  // Two sites on the list, the newer first.
  for (const name of ["Older", "Newer"]) {
    app = await launchDesktopApp({ userDataDir: userData, site: false });
    const page = await app.firstWindow();
    await stubFileDialogs(running(), join(dir, `${name}.wforge`));
    await page
      .getByRole("button", { name: "Choose a Template Yourself…", exact: true })
      .first()
      .click();
    const newSite = page.getByRole("dialog", { name: "New Site" });
    await newSite.getByRole("textbox", { name: "Site name" }).fill(name);
    await newSite.getByRole("button", { name: "Create" }).click();
    await waitForCanvas(page);
    await closeWindow();
  }

  let page = await startWithoutSite();
  const cards = page.getByRole("listitem");
  await expect(cards.first()).toContainText("Newer");
  await page.getByRole("button", { name: "Pin Older" }).click();
  await expect(cards.first()).toContainText("Older");
  await closeWindow();

  page = await startWithoutSite();
  await expect(page.getByRole("listitem").first()).toContainText("Older");
  await expect(page.getByRole("button", { name: "Pin Older" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  // Search finds a site by its name.
  await page.getByRole("searchbox", { name: "Search sites" }).fill("newer");
  await expect(page.getByRole("listitem")).toHaveCount(1);
});

test("opens a site from File › Open Recent, and Clear Recent keeps the pinned ones (3.18)", async () => {
  // Four launches: two to make the sites, then the start screen twice.
  test.slow();
  // Two sites on the list, the newer first.
  for (const name of ["Older", "Newer"]) {
    app = await launchDesktopApp({ userDataDir: userData, site: false });
    const page = await app.firstWindow();
    await stubFileDialogs(running(), join(dir, `${name}.wforge`));
    await page
      .getByRole("button", { name: "Choose a Template Yourself…", exact: true })
      .first()
      .click();
    const newSite = page.getByRole("dialog", { name: "New Site" });
    await newSite.getByRole("textbox", { name: "Site name" }).fill(name);
    await newSite.getByRole("button", { name: "Create" }).click();
    await waitForCanvas(page);
    await closeWindow();
  }

  // Newer pinned, and open in the editor from the start screen.
  let page = await startWithoutSite();
  await page.getByRole("button", { name: "Pin Newer" }).click();
  await page
    .getByRole("button", { name: /^Newer/ })
    .first()
    .click();
  await waitForCanvas(page);
  // While the window starts over with another site, there is no page to ask.
  const current = () =>
    page
      .evaluate(async () => {
        const summary = await (window as unknown as RendererWindow).webforge.project.getCurrent();
        return summary?.name;
      })
      .catch(() => undefined);
  expect(await current()).toBe("Newer");

  // Most recently opened first, pinned or not; the open site can't be opened again.
  await expect
    .poll(() => submenuItems(running(), page, "File", "Open Recent"))
    .toEqual([
      { label: "Newer", enabled: false },
      { label: "Older", enabled: true },
      { label: "Clear Recent", enabled: true },
    ]);
  // The window starts over with the site chosen, the open one saved first.
  await chooseFromSubmenu(running(), page, "File", "Open Recent", "Older");
  await expect.poll(current, { timeout: OPEN_WAIT }).toBe("Older");
  await waitForCanvas(page);

  // Clear Recent asks, then keeps the pinned site only, in the menu and on the start screen.
  await chooseFromSubmenu(running(), page, "File", "Open Recent", "Clear Recent");
  const question = page.getByRole("alertdialog", { name: "Clear the list of recent sites?" });
  await expect(question).toContainText("Sites you've pinned stay");
  await question.getByRole("button", { name: "Clear Recent" }).click();
  await expect
    .poll(() => submenuItems(running(), page, "File", "Open Recent"))
    .toEqual([
      { label: "Newer", enabled: true },
      { label: "Clear Recent", enabled: false },
    ]);
  await closeWindow();

  page = await startWithoutSite();
  await expect(page.getByRole("listitem")).toHaveCount(1);
  await expect(page.getByRole("listitem")).toContainText("Newer");
});

test("says when a site can't be opened, and removes sites from the list", async () => {
  // Open a site once, so it is on the list, then lose the file.
  app = await launchDesktopApp({ userDataDir: userData });
  await app.firstWindow();
  await app.close();
  app = undefined;

  const page = await startWithoutSite();
  const card = page.getByRole("listitem");
  await expect(card).toHaveCount(1);
  await page.getByRole("button", { name: /^Remove .+ from the list$/ }).click();
  // With none left, the first start's welcome says what to do next (SC-3).
  await expect(page.getByRole("heading", { name: "Welcome to Webforge" })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Remove .+ from the list$/ })).toHaveCount(0);

  // A file that isn't a site.
  const notes = join(dir, "notes.wforge");
  writeFileSync(notes, "just text");
  await stubFileDialogs(running(), notes);
  // The welcome's card: its actions show once, as cards, until there are recent sites (#1167).
  await page.getByRole("button", { name: /^Open a Site…/ }).click();
  // Where the person is looking, saying what to choose, and offering another (#1167).
  const alert = page.getByRole("main").getByRole("alert");
  await expect(alert).toContainText(
    "This file isn't a Webforge site. Choose a file ending in .wforge.",
  );
  await expect(alert.getByRole("button", { name: "Choose Another File…" })).toBeVisible();

  // With nothing to save, the window closes. That it doesn't sit out the save request's 5 s
  // timeout is the unit tests': the start screen answers the request (StartScreen.test.tsx), and
  // the window closes on the answer (flush-on-close.test.ts). Timed here, a busy disk's wait for
  // the store gate (ADR 0013) looked the same (ADR 0014).
  await closeWindow();
});
