import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type ElectronApplication, expect, type Page, test } from "@playwright/test";
import { placeCaret } from "./caret.js";
import { launchDesktopApp, waitForCanvas } from "./launch.js";
import { type RendererWindow, stubFileDialogs } from "./sites.js";

// The start screen (F-SITE-1, F-SITE-2): new → edit → quit → reopen from the Recent list.

/**
 * axe-core, as `@axe-core/playwright` has it: run in the canvas's own frame (2.15c), which
 * AxeBuilder's frame handling in Electron doesn't reach on every platform.
 */
const AXE_SOURCE = readFileSync(
  createRequire(createRequire(import.meta.url).resolve("@axe-core/playwright")).resolve(
    "axe-core/axe.min.js",
  ),
  "utf8",
);

type AxeResults = {
  readonly violations: readonly { readonly id: string; readonly help: string }[];
  readonly passes: readonly unknown[];
};

// The Blank template's home page (2.15c).
const STARTER_HEADING = "Welcome";

let dir: string;
let userData: string;
let app: ElectronApplication | undefined;

test.beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "webforge-start-"));
  userData = join(dir, "user-data");
});

test.afterEach(async () => {
  await app?.close();
  app = undefined;
  rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
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
  await expect(page.getByRole("heading", { name: "Start a site" })).toBeVisible();
  return page;
}

/** Closes the window as the user does, which saves and captures the Recent thumbnail. */
async function closeWindow(): Promise<void> {
  const closed = app?.waitForEvent("close");
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
  // Exactly: the title bar's New Site… button has the same name in another case.
  await page.getByRole("button", { name: "New site…", exact: true }).click();
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

test("makes a site from a template, named as typed and in the chosen theme, in under 3 s", async () => {
  const page = await startWithoutSite();
  await stubFileDialogs(running(), join(dir, "Rosa's Bakery.wforge"));

  // New Site (2.14a, F-SITE-1): the name, a template (which brings its theme), then another theme.
  // Exactly: the title bar's New Site… button has the same name in another case.
  await page.getByRole("button", { name: "New site…", exact: true }).click();
  const newSite = page.getByRole("dialog", { name: "New Site" });
  await newSite.getByRole("textbox", { name: "Site name" }).fill("Rosa's Bakery");
  await newSite.getByText("Sample bakery", { exact: true }).click();
  await expect(newSite.getByRole("radio", { name: "Light" })).toBeChecked();
  await newSite.getByText("Atelier", { exact: true }).click();

  const started = Date.now();
  await newSite.getByRole("button", { name: "Create" }).click();
  // Open in under 3 s (F-SITE-1): the template's home page on the canvas. Nearly all of it is the
  // editor starting again on the new site, as for every site opened; the fill itself is quick.
  const hero = canvas(page).locator("h1", { hasText: "Fresh bread, baked every morning" });
  await expect(hero).toBeVisible();
  expect(Date.now() - started).toBeLessThan(3_000);
  // With its photo, which came into the site's Media.
  await expect(canvas(page).locator("section img").first()).toHaveJSProperty("complete", true);
  await expect(canvas(page).locator("section img").first()).not.toHaveJSProperty("naturalWidth", 0);

  const site = await page.evaluate(async () => {
    const read = await (window as unknown as RendererWindow).webforge.project.readSite();
    return read as { site: { settings: { general: { name: string } }; theme: { preset: string } } };
  });
  expect(site.site.settings.general.name).toBe("Rosa's Bakery");
  expect(site.site.theme.preset).toBe("atelier");
});

test("makes a Personal / CV site in under 3 s, accessible on the canvas (2.15c)", async () => {
  const page = await startWithoutSite();
  await stubFileDialogs(running(), join(dir, "Sam Lee.wforge"));

  await page.getByRole("button", { name: "New site…", exact: true }).click();
  const newSite = page.getByRole("dialog", { name: "New Site" });
  await newSite.getByRole("textbox", { name: "Site name" }).fill("Sam Lee");
  await newSite.getByText("Personal / CV", { exact: true }).click();
  await expect(newSite.getByRole("radio", { name: "Studio" })).toBeChecked();

  const started = Date.now();
  await newSite.getByRole("button", { name: "Create" }).click();
  const hero = canvas(page).locator("h1", { hasText: "Hello, I'm Alex Morgan" });
  await expect(hero).toBeVisible();
  expect(Date.now() - started).toBeLessThan(3_000);
  await expect(canvas(page).locator("section img").first()).not.toHaveJSProperty("naturalWidth", 0);

  // The page as the canvas draws it, inside its frame, what the editor adds to it included (#465):
  // the frame's title and language, and the inline editors' names. One rule stays off: dnd-kit
  // makes Puck's wrapper around each element a button, with the element's links and text inside
  // (nested-interactive). As a group the canvas tests' clicks no longer reach the elements (#465).
  const frame = await page.locator(".editor__canvas iframe").elementHandle();
  const canvasFrame = await frame?.contentFrame();
  if (canvasFrame === null || canvasFrame === undefined) throw new Error("No canvas frame");
  await canvasFrame.evaluate(AXE_SOURCE);
  const results = await canvasFrame.evaluate(
    async (tags) => {
      const { axe } = window as unknown as {
        axe: { run(context: Document, options: object): Promise<AxeResults> };
      };
      const { violations, passes } = await axe.run(document, {
        runOnly: { type: "tag", values: tags },
        rules: { "nested-interactive": { enabled: false } },
      });
      return {
        violations: violations.map(({ id, help }) => ({ id, help })),
        passes: passes.length,
      };
    },
    ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"],
  );
  expect(results.violations.map((violation) => `${violation.id}: ${violation.help}`)).toEqual([]);
  // It checked the page: rules passed inside the frame.
  expect(results.passes).toBeGreaterThan(5);
});

test("tries the example: a pre-filled site named after it, in under 3 s (2.14b, PG-3)", async () => {
  const page = await startWithoutSite();
  await stubFileDialogs(running(), join(dir, "Sample bakery.wforge"));

  const started = Date.now();
  // Straight from the start screen: no New Site dialog, the example's own name and theme.
  // Exactly: the first start's welcome has a Try an example card too.
  await page.getByRole("button", { name: "Try an example", exact: true }).click();
  const hero = canvas(page).locator("h1", { hasText: "Fresh bread, baked every morning" });
  await expect(hero).toBeVisible();
  expect(Date.now() - started).toBeLessThan(3_000);

  const site = await page.evaluate(async () => {
    const read = await (window as unknown as RendererWindow).webforge.project.readSite();
    return read as { site: { settings: { general: { name: string } }; pageOrder: string[] } };
  });
  expect(site.site.settings.general.name).toBe("Sample bakery");
  expect(site.site.pageOrder.length).toBeGreaterThan(1);
});

test("pins a site to the top of the Recent list, which it keeps after a restart (2.14b)", async () => {
  // Two sites on the list, the newer first.
  for (const name of ["Older", "Newer"]) {
    app = await launchDesktopApp({ userDataDir: userData, site: false });
    const page = await app.firstWindow();
    await stubFileDialogs(running(), join(dir, `${name}.wforge`));
    await page.getByRole("button", { name: "New site…", exact: true }).click();
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

  // With nothing to save, closing doesn't wait for a save that never comes (5 s timeout).
  const started = Date.now();
  await closeWindow();
  expect(Date.now() - started).toBeLessThan(3_000);
});
