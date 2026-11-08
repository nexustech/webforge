import { mkdtempSync, readFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type ElectronApplication, expect, type Page, test } from "@playwright/test";
import { createSite } from "@webforge/model";
import { ProjectStore } from "@webforge/storage";
import { launchDesktopApp, newUserDataDir } from "./launch.js";
import { chooseFromMenu } from "./menus.js";
import { type MockNetlify, startMockNetlify } from "./netlify-mock.js";

// A Netlify destination added in the Publish dialog (4.4b, #723), against the mock of Netlify's
// API on this computer (`netlify-mock.ts`, 4.2 part 3): signed in with a pasted token, its site
// chosen or made, Netlify Forms offered once it's there, and published through 4.5's flow. The mock
// serves its sites at http:// addresses, which the app doesn't keep (only https://), so here they
// are listed by name alone.

let app: ElectronApplication | undefined;
let netlify: MockNetlify | undefined;
let dir: string;
let userData: string;

test.beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "webforge-netlify-ui-"));
  userData = newUserDataDir();
});

test.afterEach(async () => {
  await app?.close();
  app = undefined;
  await netlify?.close();
  netlify = undefined;
  await rm(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  await rm(userData, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
});

/** A site with a contact form that has nowhere to send yet, saved at a new path. */
function siteWithContactForm(): string {
  const path = join(dir, "Rosa's Bakery.wforge");
  const created = ProjectStore.create(path, { name: "Rosa's Bakery" });
  const site = createSite({
    name: "Rosa's Bakery",
    language: "en",
    homeTitle: "Home",
    notFoundTitle: "Not found",
  });
  site.settings.address.url = "https://rosas-bakery.netlify.app";
  const home = site.pages[site.homePageId];
  if (home === undefined) throw new Error("no home page");
  home.doc.content.push({ type: "ContactForm", props: { id: "write", title: "Write to us" } });
  created.saveSite(site);
  created.close();
  return path;
}

/** The app open on the site at `path`, pointed at the mock. */
async function open(path: string, mock: MockNetlify): Promise<Page> {
  app = await launchDesktopApp({
    userDataDir: userData,
    args: [path],
    env: { WEBFORGE_E2E_NETLIFY_API: mock.apiBase },
  });
  const page = await app.firstWindow();
  await page.waitForLoadState("domcontentloaded");
  await expect(page.getByRole("button", { name: "Publish…", exact: true })).toBeEnabled();
  return page;
}

/** Site Settings' Forms section, open on `page`. */
async function formSettings(page: Page) {
  if (app === undefined) throw new Error("no app");
  await chooseFromMenu(app, page, "File", "Site Settings…");
  const settings = page.getByRole("dialog", { name: "Settings", exact: true });
  await settings.getByRole("tab", { name: "Forms" }).click();
  return settings;
}

/** The Publish dialog's *Add Destination › Netlify…*, signed in with the mock's token. */
async function addNetlify(page: Page, mock: MockNetlify) {
  await page.getByRole("button", { name: "Publish…", exact: true }).click();
  const publish = page.getByRole("dialog", { name: "Publish" });
  await publish.getByRole("button", { name: "Add Destination" }).click();
  await page.getByRole("menuitem", { name: "Netlify…" }).click();
  const form = page.getByRole("dialog", { name: "Add a Netlify Destination" });
  // Netlify's own sign-in waits for the app's client ID: only the token until then.
  await expect(form.getByRole("button", { name: "Sign In with Netlify" })).toHaveCount(0);
  await form.getByLabel("Personal access token").fill(mock.token);
  await form.getByRole("button", { name: "Connect" }).click();
  await expect(form.getByText("Signed in to Netlify.")).toBeVisible();
  return { publish, form };
}

test("adds a Netlify destination by token, offers Netlify Forms, and publishes to it (4.4b)", async () => {
  test.skip(
    process.platform !== "win32" && process.platform !== "darwin",
    "the sign-in is kept in the OS keychain, Windows' and macOS's (ADR 0006 §5)",
  );
  netlify = await startMockNetlify();
  const siteId = await netlify.addSite("rosas-bakery");
  const staging = await netlify.addSite("rosas-staging");
  netlify.protect(staging);
  const path = siteWithContactForm();
  const page = await open(path, netlify);

  // No Netlify destination yet: no Netlify Forms.
  let settings = await formSettings(page);
  await expect(
    settings.getByLabel("Form service").locator("option", { hasText: "Netlify Forms" }),
  ).toHaveCount(0);
  await settings.getByRole("button", { name: "Cancel" }).click();
  await expect(settings).toHaveCount(0);

  const { publish, form } = await addNetlify(page, netlify);
  const site = form.getByLabel("Netlify site");
  // A site whose visitors must log in to Netlify is warned about; the other isn't.
  await site.selectOption({ label: "rosas-staging" });
  await expect(form.getByText("Visitors have to log in to see this site")).toBeVisible();
  await site.selectOption({ label: "rosas-bakery" });
  await expect(form.getByText("Visitors have to log in to see this site")).toHaveCount(0);
  await form.getByRole("button", { name: "Save Destination" }).click();
  await expect(form).toBeHidden();

  // Listed, named after its site, and tested with the sign-in main keeps.
  const row = publish.getByRole("listitem").filter({ hasText: "rosas-bakery" });
  await expect(row.getByText("Netlify", { exact: true })).toBeVisible();
  await publish.getByRole("button", { name: "Test the connection to rosas-bakery" }).click();
  await expect(row.getByText(/Connected/)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(publish).toHaveCount(0);

  // Netlify Forms is offered now, and chosen for the contact form.
  settings = await formSettings(page);
  await settings.getByLabel("Form service").selectOption({ label: "Netlify Forms" });
  await settings.getByRole("button", { name: "Save" }).click();
  await expect(settings).toHaveCount(0);

  // Published through 4.5's flow: Netlify finds the form by its name.
  await page.getByRole("button", { name: "Publish…", exact: true }).click();
  await publish.getByRole("button", { name: "Publish to rosas-bakery" }).click();
  const live = page.getByRole("dialog", { name: "Your site is live" });
  await expect(live).toBeVisible({ timeout: 60_000 });
  await expect(live.getByText(/^Sent: \d+ · Unchanged: 0 · Removed: 0$/)).toBeVisible();
  expect(netlify.uploads()).toContain("index.html");
  expect(netlify.file(siteId, "index.html")).toContain('data-netlify="true"');
  expect((await netlify.forms(siteId)).map(({ name }) => name)).toEqual(["Contact form"]);
  await live.getByRole("button", { name: "Done" }).click();
  await app?.close();
  app = undefined;

  // The token never reaches the site's file; the destination names its site.
  expect(readFileSync(path).includes(netlify.token)).toBe(false);
  const store = ProjectStore.open(path, { readOnly: true });
  try {
    expect(store.readPublishDestinations()).toEqual([
      expect.objectContaining({ name: "rosas-bakery", kind: "netlify", siteId }),
    ]);
  } finally {
    store.close();
  }
});

test("makes a new Netlify site for the destination, named as asked (4.4b)", async () => {
  test.skip(
    process.platform !== "win32" && process.platform !== "darwin",
    "the sign-in is kept in the OS keychain, Windows' and macOS's (ADR 0006 §5)",
  );
  netlify = await startMockNetlify();
  const path = siteWithContactForm();
  const page = await open(path, netlify);

  const { publish, form } = await addNetlify(page, netlify);
  await form.getByLabel("Netlify site").selectOption({ label: "A new site" });
  await form.getByLabel("New site's name").fill("rosas-new");
  await form.getByLabel("Name", { exact: true }).fill("Rosa's shop");
  await form.getByRole("button", { name: "Save Destination" }).click();
  await expect(form).toBeHidden();

  // Made on Netlify, as named, and the destination's site.
  await expect(publish.getByRole("button", { name: "Publish to Rosa's shop" })).toBeEnabled();
  const made = netlify.siteNamed("rosas-new");
  expect(made).toBeDefined();
  await app?.close();
  app = undefined;
  const store = ProjectStore.open(path, { readOnly: true });
  try {
    expect(store.readPublishDestinations()).toEqual([
      expect.objectContaining({ name: "Rosa's shop", kind: "netlify", siteId: made }),
    ]);
  } finally {
    store.close();
  }
});
