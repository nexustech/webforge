import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type ElectronApplication, expect, type Page, test } from "@playwright/test";
import { heroPhoto } from "@webforge/test-utils";
import { placeCaret } from "./caret.js";
import { launchDesktopApp, waitForCanvas } from "./launch.js";
import { chooseFromMenu } from "./menus.js";
import { type RendererWindow, stubFileDialogs } from "./sites.js";

// Phase 1's exit criterion 1 (spec/04, #436): a three-page site built from blank in the editor,
// closed and reopened from the Recent list, comes back as it was, page by page. Its undo history
// starts afresh, and undoing the whole first session leads back to the blank site. The same run
// takes screenshots of the shell, dark and light, for the exit demo (attachments, not baselines).

let dir: string;
let userData: string;
let app: ElectronApplication | undefined;

test.beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "webforge-exit-"));
  userData = join(dir, "user-data");
});

test.afterEach(async () => {
  await app?.close();
  app = undefined;
  rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
});

/** The running app; the test calls it once it has launched one. */
function running(): ElectronApplication {
  if (app === undefined) throw new Error("The app is not running");
  return app;
}

/** Launches the app with nothing open: the start screen. */
async function startWithoutSite(): Promise<Page> {
  app = await launchDesktopApp({ userDataDir: userData, site: false });
  const page = await app.firstWindow();
  await expect(page.getByRole("heading", { name: "Start a site" })).toBeVisible();
  return page;
}

/** Closes the window as the person does, which saves the site and lists it in Recent. */
async function closeWindow(): Promise<void> {
  const closed = app?.waitForEvent("close");
  await app?.evaluate(({ BrowserWindow }) => {
    BrowserWindow.getAllWindows()[0]?.close();
  });
  await closed;
  app = undefined;
}

/** A name matched from its start, as it is: a page's name may hold brackets ("Home page"). */
const startsWith = (name: string) => new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`);

/** A node of a site's documents: its kind and its props. */
type SiteNode = { readonly type: string; readonly props: Readonly<Record<string, unknown>> };

/** Every node in `value`, however deep: pages' content, shared sections, slots. */
function nodesIn(value: unknown): SiteNode[] {
  if (Array.isArray(value)) return value.flatMap(nodesIn);
  if (typeof value !== "object" || value === null) return [];
  const own =
    "type" in value && "props" in value && typeof value.type === "string"
      ? [value as SiteNode]
      : [];
  return [...own, ...Object.values(value).flatMap(nodesIn)];
}

/** The open site as the main process keeps it: what the file holds, read back over IPC. */
const readSite = (page: Page) =>
  page.evaluate(() => (window as unknown as RendererWindow).webforge.project.readSite());

/**
 * What a site's pages, settings and shared sections are: what the person built, without what
 * comes and goes with the editor (Media's files, which undo doesn't take back).
 */
function built(read: unknown) {
  const { status, site } = read as { status: string; site?: Record<string, unknown> };
  if (status !== "ok" || site === undefined)
    throw new Error(`The site couldn't be read: ${status}`);
  const { pages, pageOrder, settings, sharedSections, layout } = site;
  return { pages, pageOrder, settings, sharedSections, layout };
}

test("a three-page site built from blank comes back as it was, page by page", async () => {
  const testInfo = test.info();
  test.setTimeout(240_000);
  let page = await startWithoutSite();
  const sitePath = join(dir, "Rosa's Bakery.wforge");
  await stubFileDialogs(running(), sitePath);
  // New Site, Blank (2.14a); exactly, as the title bar's New Site… has the same name in another case.
  await page.getByRole("button", { name: "New site…", exact: true }).click();
  const newSite = page.getByRole("dialog", { name: "New Site" });
  await newSite.getByRole("textbox", { name: "Site name" }).fill("Rosa's Bakery");
  await newSite.getByRole("button", { name: "Create" }).click();
  await waitForCanvas(page);
  await expect(page.getByRole("banner").getByRole("status")).toHaveText("Saved");
  const blank = built(await readSite(page));

  const canvas = () => page.frameLocator(".editor__canvas iframe");
  const left = () => page.getByRole("region", { name: "Left panels" });
  const right = () => page.getByRole("region", { name: "Right panels" });
  const pages = () => page.getByRole("list", { name: "Pages" });
  const tree = () => left().getByRole("tree", { name: "Layers" });
  const row = (name: string) => tree().getByRole("treeitem", { name: startsWith(name) });
  const steps = () => page.locator(".undo-history__step");
  /** The page's sections, as Layers lists them: its top-level rows, whatever kind each is. */
  const sections = () => tree().locator('[role="treeitem"][aria-level="1"]');
  const showTab = (region: () => ReturnType<typeof left>, name: string) =>
    region().getByRole("tab", { name, exact: true }).click();
  /** Adds item `name` from the Add panel's tab `tab` (Sections or Elements). */
  const add = async (tab: "Sections" | "Elements", name: string) => {
    await showTab(left, "Add");
    await left().getByRole("tab", { name: tab }).click();
    await left().getByRole("button", { name, exact: true }).click();
  };
  /** Selects the first Section of the page shown, by its bottom padding. */
  const selectSection = async () => {
    await showTab(right, "Edit");
    const section = canvas().locator(".site-section").first();
    const box = await section.boundingBox();
    if (box === null) throw new Error("Section not visible");
    await section.click({ force: true, position: { x: 10, y: box.height - 16 } });
    await expect(right().getByRole("heading", { name: "Section", exact: true })).toBeVisible();
  };
  /** Adds a page named `name` from the Site panel; the canvas then shows it. */
  const addPage = async (name: string) => {
    await showTab(right, "Site");
    await page.getByRole("button", { name: "Add Page" }).click();
    await page.getByRole("textbox", { name: "Page name" }).fill(name);
    await page.getByRole("dialog").getByRole("button", { name: "Add Page" }).click();
    await expect(pages().getByRole("button", { name: startsWith(name) })).toHaveAttribute(
      "aria-current",
      "page",
    );
  };
  const showPage = async (name: string) => {
    await showTab(right, "Site");
    await pages()
      .getByRole("button", { name: startsWith(name) })
      .click();
    await waitForCanvas(page);
  };

  // Media: a photo, through the native file dialog (stubbed).
  const photoPath = join(dir, "Shop front.jpg");
  writeFileSync(photoPath, heroPhoto());
  await stubFileDialogs(running(), photoPath);
  await page.getByRole("tab", { name: "Media" }).click();
  await page
    .getByRole("region", { name: "Media" })
    .getByRole("button", { name: "Add images or files…" })
    .click();
  await expect(
    page.getByRole("region", { name: "Media" }).getByRole("button", { name: "Shop front.jpg" }),
  ).toBeVisible();

  // Page 1, the home page: its heading edited, an Image of the photo, its Text renamed in Layers,
  // the Image hidden, and its Section saved as a shared section.
  await showTab(right, "Site");
  // The home page's title, as the site keeps it (its row adds "Home page" after it).
  const { site: opened } = (await readSite(page)) as {
    site: { homePageId: string; pages: Record<string, { title: string }> };
  };
  const home = opened.pages[opened.homePageId]?.title ?? "";
  const heading = canvas().locator("h1 [contenteditable]");
  await heading.hover();
  await heading.click();
  await placeCaret(heading, "end");
  await page.keyboard.type(" today", { delay: 20 });
  await expect(canvas().locator("h1")).toHaveText("Welcome to our business today");

  await selectSection();
  await add("Elements", "Image");
  await right().getByRole("button", { name: "Image Choose an image…" }).click();
  const picker = page.getByRole("dialog", { name: "Choose an image" });
  // Found by its name and chosen with Enter, as the picker takes it (UX-15).
  await expect(picker.getByRole("option", { name: /Shop front/ })).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(picker).toBeHidden();
  await expect(canvas().locator(".site-section img")).toHaveCount(1);

  // From its row in Layers, which renames it in place: on the canvas the new Image's element bar
  // can cover the Text.
  await showTab(left, "Layers");
  await row("Text").click({ button: "right" });
  await page.getByRole("menu").getByRole("menuitem", { name: "Rename" }).click();
  await tree().getByRole("textbox", { name: "Name for this Text" }).fill("Intro");
  await page.keyboard.press("Enter");
  await expect(row("Intro")).toBeVisible();
  await tree().getByRole("button", { name: "Hide Image" }).click();
  await expect(tree().getByRole("button", { name: "Show Image" })).toBeVisible();

  await selectSection();
  await chooseFromMenu(running(), page, "Edit", "Save as shared section…");
  const save = page.getByRole("dialog", { name: "Save as shared section" });
  await save.getByRole("textbox", { name: "Name" }).fill("Welcome");
  await save.getByRole("button", { name: "Save" }).click();
  await expect(save).toHaveCount(0);

  // Page 2: a Hero, then a linked copy of the shared section, and a page setting.
  await addPage("About us");
  await add("Sections", "Hero");
  await expect(sections()).toHaveCount(1);
  await showTab(left, "Add");
  await left().getByRole("tab", { name: "Sections" }).click();
  await left()
    .getByRole("list", { name: "Shared sections" })
    .getByRole("button", { name: "Welcome", exact: true })
    .click();
  await expect(sections()).toHaveCount(2);
  await pages().getByRole("button", { name: "Actions for About us" }).click();
  await page.getByRole("menuitem", { name: "Page Settings…" }).click();
  const pageSettings = page.getByRole("dialog", { name: "Settings for 'About us'" });
  await pageSettings.getByRole("textbox", { name: "Description" }).fill("How we started");
  await pageSettings.getByRole("button", { name: "Save" }).click();
  await expect(pageSettings).toHaveCount(0);

  // Page 3: a Text section of its own.
  await addPage("Contact");
  await add("Sections", "Text");
  await expect(sections()).toHaveCount(1);

  // Site Settings: the business's email.
  await chooseFromMenu(running(), page, "File", "Site Settings…");
  const settings = page.getByRole("dialog", { name: "Settings", exact: true });
  await settings.getByRole("tab", { name: "Contact & hours" }).click();
  await settings.getByLabel("Email address", { exact: true }).fill("hello@rosas.example");
  await settings.getByRole("button", { name: "Save" }).click();
  await expect(settings).toHaveCount(0);
  await expect(page.getByRole("banner").getByRole("status")).toHaveText("Saved", {
    timeout: 10_000,
  });
  const done = built(await readSite(page));
  expect(Object.keys(done.pages as object)).toHaveLength(
    Object.keys(blank.pages as object).length + 2,
  );

  // Undoing the whole session leads back to the blank site; redoing it to the built one.
  const undo = page.getByRole("banner").getByRole("button", { name: "Undo", exact: true });
  const redo = page.getByRole("banner").getByRole("button", { name: "Redo", exact: true });
  while (await undo.isEnabled()) await undo.click();
  await expect.poll(async () => built(await readSite(page))).toEqual(blank);
  while (await redo.isEnabled()) await redo.click();
  await expect.poll(async () => built(await readSite(page))).toEqual(done);

  // The shell for the exit demo, 1280 × 800, the Heading selected so the Edit panel shows.
  await running().evaluate(({ BrowserWindow }) => {
    const window = BrowserWindow.getAllWindows()[0];
    window?.unmaximize();
    window?.setContentSize(1280, 800);
  });
  await showPage(home);
  const box = await canvas().locator("h1").boundingBox();
  if (box === null) throw new Error("Heading not visible");
  await showTab(right, "Edit");
  await canvas()
    .locator("h1")
    .click({ position: { x: box.width * 0.97, y: box.height - 2 } });
  await expect(right().getByRole("heading", { name: "Heading", exact: true })).toBeVisible();
  for (const theme of ["dark", "light"] as const) {
    if (theme === "light") await chooseFromMenu(running(), page, "View", "Use Light Theme");
    const path = testInfo.outputPath(`phase-1-shell-${theme}.png`);
    await page.screenshot({ path });
    await testInfo.attach(`Phase 1 shell, ${theme}`, { path, contentType: "image/png" });
  }
  await closeWindow();

  // Reopened from Recent: everything as it was, and the history starts afresh.
  page = await startWithoutSite();
  await page
    .getByRole("listitem")
    .filter({ hasText: "Rosa's Bakery" })
    .getByRole("button")
    .first()
    .click();
  await waitForCanvas(page);
  expect(built(await readSite(page))).toEqual(done);

  await showTab(left, "Undo History");
  await expect(steps()).toHaveText(["Opened page"]);

  // Page by page, as the person sees it.
  await showTab(right, "Site");
  await expect(pages().getByRole("button", { name: /^(?!Actions)/ })).toHaveText([
    startsWith(home),
    /^About us/,
    /^Contact/,
    /^Page not found/,
  ]);
  await showPage(home);
  await expect(canvas().locator("h1")).toHaveText("Welcome to our business today");
  // The home page's section is a linked copy now, which Layers lists as one row: its renamed Text
  // and hidden Image are the shared section's, in the site and on the canvas (dimmed).
  const reopened = built(await readSite(page));
  const all = nodesIn(reopened);
  expect(all.some((node) => node.props.layerName === "Intro")).toBe(true);
  expect(all.some((node) => node.type === "Image" && node.props.hidden === true)).toBe(true);
  await expect(canvas().locator("[data-webforge-hidden] img")).toHaveCount(1);
  await showTab(left, "Layers");
  await expect(sections()).toHaveText([/^Linked copy of 'Welcome'/]);
  await showPage("About us");
  await expect(sections()).toHaveCount(2);
  await expect(tree().getByRole("treeitem", { name: /Welcome/ })).toBeVisible();
  await showPage("Contact");
  await expect(sections()).toHaveCount(1);
  await page.getByRole("tab", { name: "Media" }).click();
  await expect(
    page.getByRole("region", { name: "Media" }).getByRole("button", { name: "Shop front.jpg" }),
  ).toBeVisible();
});
