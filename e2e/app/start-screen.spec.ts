import { mkdtempSync, writeFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type ElectronApplication, expect, type Page, test } from "@playwright/test";
import { expectWorkWithin, measureWork, OPEN_WAIT, openBudget } from "./budget.js";
import { canvasAxe } from "./canvas-axe.js";
import { placeCaret } from "./caret.js";
import { launchDesktopApp, type WebforgeApp, waitForCanvas } from "./launch.js";
import { chooseFromSubmenu, submenuItems } from "./menus.js";
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
  await rm(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
});

const canvas = (page: Page) => page.frameLocator(".editor__canvas iframe");

/** The running app; tests call it once they have launched one. */
function running(): ElectronApplication {
  if (app === undefined) throw new Error("The app is not running");
  return app;
}

async function startWithoutSite(): Promise<Page> {
  app = await launchDesktopApp({ userDataDir: userData, site: false });
  const page = await app.firstWindow();
  await expect(page.getByRole("heading", { name: "Get started" })).toBeVisible();
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

test("creates a blank site, keeps an edit and reopens it from the Recent list", async () => {
  let page = await startWithoutSite();
  await expect(page.getByText("Sites you open or create appear here.")).toBeVisible();

  // New Site, Blank: the save dialog (stubbed) names the file, and the editor opens on it.
  const sitePath = join(dir, "Rosa's Bakery.wforge");
  await stubFileDialogs(running(), sitePath);
  // The start screen's own (the welcome offers it too), not the title bar's New Site….
  await page
    .getByRole("button", { name: "Choose a template yourself…", exact: true })
    .first()
    .click();
  const newSite = page.getByRole("dialog", { name: "New Site" });
  await newSite.getByRole("textbox", { name: "Site name" }).fill("Rosa's Bakery");
  await newSite.getByRole("button", { name: "Create" }).click();
  await waitForCanvas(page);
  await expect(page.getByRole("banner").getByRole("status")).toHaveText("Saved");
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
    .getByRole("button", { name: "Choose a template yourself…", exact: true })
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
  expectWorkWithin(await opened(), openBudget(), "Opening the new Café site");
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
    .getByRole("button", { name: "Choose a template yourself…", exact: true })
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
  expectWorkWithin(await opened(), openBudget(), "Opening the new Personal / CV site");
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
  await page.getByRole("button", { name: "Try an example", exact: true }).click();
  // The first example the app ships: Café / Restaurant (Trades is the second).
  const hero = canvas(page).locator("h1", { hasText: "Good coffee and proper breakfasts" });
  await expect(hero).toBeVisible({ timeout: OPEN_WAIT });
  expectWorkWithin(await opened(), openBudget(), "Opening the example");

  const site = await page.evaluate(async () => {
    const read = await (window as unknown as RendererWindow).webforge.project.readSite();
    return read as { site: { settings: { general: { name: string } }; pageOrder: string[] } };
  });
  expect(site.site.settings.general.name).toBe("Café / Restaurant");
  expect(site.site.pageOrder.length).toBeGreaterThan(1);
});

test("pins a site to the top of the Recent list, which it keeps after a restart (2.14b)", async () => {
  // Two sites on the list, the newer first.
  for (const name of ["Older", "Newer"]) {
    app = await launchDesktopApp({ userDataDir: userData, site: false });
    const page = await app.firstWindow();
    await stubFileDialogs(running(), join(dir, `${name}.wforge`));
    await page
      .getByRole("button", { name: "Choose a template yourself…", exact: true })
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
      .getByRole("button", { name: "Choose a template yourself…", exact: true })
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

  // Most recently opened first, pinned or not.
  await expect
    .poll(() => submenuItems(running(), page, "File", "Open Recent"))
    .toEqual([
      { label: "Newer", enabled: true },
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
  // Exactly: the welcome has an Open a site card too.
  await page.getByRole("button", { name: "Open a site…", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText("This file isn't a Webforge site.");

  // With nothing to save, the window closes. That it doesn't sit out the save request's 5 s
  // timeout is the unit tests': the start screen answers the request (StartScreen.test.tsx), and
  // the window closes on the answer (flush-on-close.test.ts). Timed here, a busy disk's wait for
  // the store gate (ADR 0013) looked the same (ADR 0014).
  await closeWindow();
});
