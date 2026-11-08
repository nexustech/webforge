import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type ElectronApplication, expect, type Page, test } from "@playwright/test";
import { createSite, type PageId } from "@webforge/model";
import { ProjectStore } from "@webforge/storage";
import { startSftpServer } from "../packaged/sftp-server.js";
import { launchDesktopApp, newUserDataDir } from "./launch.js";

// A made-up password: the test never touches a real credential.
const PASSWORD = "test-only-sftp-password";

let app: ElectronApplication | undefined;
let server: Awaited<ReturnType<typeof startSftpServer>> | undefined;
let dir: string;
let userData: string;

test.beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "webforge-publish-"));
  userData = newUserDataDir();
});

test.afterEach(async () => {
  await app?.close();
  app = undefined;
  await server?.stop();
  server = undefined;
  await rm(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  await rm(userData, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
});

/**
 * Adds the SFTP test server as destination "Test host", from the Publish dialog showing on `page`,
 * trusting its key and saving its password.
 */
async function addTestHost(page: Page, sftp: Awaited<ReturnType<typeof startSftpServer>>) {
  const publish = page.getByRole("dialog", { name: "Publish" });
  await publish.getByRole("button", { name: "Add Destination" }).click();
  // Which kind (4.4b): a web host, rather than Netlify.
  await page.getByRole("menuitem", { name: "FTP, FTPS or SFTP…" }).click();
  const form = page.getByRole("dialog", { name: "Publish to your web host" });
  await form.getByLabel("Name", { exact: true }).fill("Test host");
  await form.getByLabel("Connection", { exact: true }).selectOption("sftp");
  await form.getByLabel("Host", { exact: true }).fill("127.0.0.1");
  await form.getByLabel("Port", { exact: true }).fill(String(sftp.port));
  await form.getByLabel("User name", { exact: true }).fill("baker");
  await form.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await form.getByLabel("Folder", { exact: true }).fill("/site");
  await form.getByRole("button", { name: "Test Connection" }).click();
  await form.getByRole("button", { name: "Trust This Host" }).click();
  await expect(form.getByText(/Connected/)).toBeVisible();
  await form.getByRole("button", { name: "Save" }).click();
  await expect(form).toBeHidden();
}

/** The site at `path` open in the app, with the Publish dialog showing its destinations. */
async function openPublish(path: string): Promise<Page> {
  app = await launchDesktopApp({ userDataDir: userData, args: [path] });
  const page = await app.firstWindow();
  await page.waitForLoadState("domcontentloaded");
  await page.getByRole("button", { name: "Publish…", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Publish" })).toBeVisible();
  return page;
}

test("adds an SFTP destination and keeps its password in the keychain, never the site file (4.4a)", async () => {
  test.skip(
    process.platform !== "win32" && process.platform !== "darwin",
    "the OS keychain is Windows' and macOS's (ADR 0006 §5)",
  );
  server = await startSftpServer({ user: "baker", password: PASSWORD });
  const path = join(dir, "Rosa's Bakery.wforge");
  ProjectStore.create(path, { name: "Rosa's Bakery" }).close();

  const page = await openPublish(path);
  const publish = page.getByRole("dialog", { name: "Publish" });
  await expect(publish.getByText(/No destinations yet/)).toBeVisible();
  await publish.getByRole("button", { name: "Add Destination" }).click();
  // Which kind (4.4b): a web host, rather than Netlify.
  await page.getByRole("menuitem", { name: "FTP, FTPS or SFTP…" }).click();

  const form = page.getByRole("dialog", { name: "Publish to your web host" });
  await form.getByLabel("Name", { exact: true }).fill("Test host");
  await form.getByLabel("Connection", { exact: true }).selectOption("sftp");
  await form.getByLabel("Host", { exact: true }).fill("127.0.0.1");
  await form.getByLabel("Port", { exact: true }).fill(String(server.port));
  await form.getByLabel("User name", { exact: true }).fill("baker");
  await form.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await form.getByLabel("Folder", { exact: true }).fill("/site");
  await form.getByLabel("Web address", { exact: true }).fill("https://www.rosas-bakery.example");
  // The host's key is trusted the first time, then the sign-in tested.
  await form.getByRole("button", { name: "Test Connection" }).click();
  await form.getByRole("button", { name: "Trust This Host" }).click();
  await expect(form.getByText(/Connected/)).toBeVisible();
  await form.getByRole("button", { name: "Save" }).click();
  await expect(form).toBeHidden();

  // Listed, and tested from the list with the password main keeps.
  await expect(publish.getByText("127.0.0.1 · /site")).toBeVisible();
  await publish.getByRole("button", { name: "Test the connection to Test host" }).click();
  await expect(publish.getByText(/Connected/)).toBeVisible();
  await app?.close();
  app = undefined;

  // Neither the password nor the host's key is in the site's file; its web address is filled in.
  const file = readFileSync(path);
  expect(file.includes(PASSWORD)).toBe(false);
  expect(file.includes("SHA256:")).toBe(false);
  const store = ProjectStore.open(path, { readOnly: true });
  try {
    expect(store.readPublishDestinations()).toEqual([
      expect.objectContaining({ name: "Test host", kind: "file-transfer" }),
    ]);
    expect(store.readSite().settings.address.url).toBe("https://www.rosas-bakery.example");
  } finally {
    store.close();
  }

  // The next run reads the password back from the keychain (DPAPI, Keychain).
  const again = await openPublish(path);
  const reopened = again.getByRole("dialog", { name: "Publish" });
  await reopened.getByRole("button", { name: "Test the connection to Test host" }).click();
  await expect(reopened.getByText(/Connected/)).toBeVisible();
});

test("publishes the site to an SFTP host, then keeps the version it went live with (4.5)", async () => {
  test.skip(
    process.platform !== "win32" && process.platform !== "darwin",
    "the OS keychain is Windows' and macOS's (ADR 0006 §5)",
  );
  server = await startSftpServer({ user: "baker", password: PASSWORD });
  // A site Site Check lets publish: nothing to fill in, and its web address. The destination has
  // none, so the live check reaches no other website.
  const path = join(dir, "Rosa's Bakery.wforge");
  const created = ProjectStore.create(path, { name: "Rosa's Bakery" });
  const site = createSite({
    name: "Rosa's Bakery",
    language: "en",
    homeTitle: "Home",
    notFoundTitle: "Not found",
  });
  site.settings.address.url = "https://www.rosas-bakery.example";
  created.saveSite(site);
  created.close();

  const page = await openPublish(path);
  const publish = page.getByRole("dialog", { name: "Publish" });
  await addTestHost(page, server);

  await publish.getByRole("button", { name: "Publish to Test host" }).click();
  const live = page.getByRole("dialog", { name: "Your site is live" });
  await expect(live).toBeVisible({ timeout: 60_000 });
  await expect(live.getByText(/Edit the destination to add its web address/)).toBeVisible();
  await expect(live.getByText(/^Sent: \d+ · Unchanged: 0 · Removed: 0$/)).toBeVisible();
  await expect(live.getByText(/Version History/)).toHaveCount(0);
  // On the host: the built site, with the record that names it as this site's.
  expect(existsSync(join(server.site, "index.html"))).toBe(true);
  expect(readFileSync(join(server.site, "index.html"), "utf8")).toContain("<html");
  await live.getByRole("button", { name: "Done" }).click();

  // Published again, nothing has changed: nothing is sent.
  await page.getByRole("button", { name: "Publish…", exact: true }).click();
  await page
    .getByRole("dialog", { name: "Publish" })
    .getByRole("button", { name: "Publish to Test host" })
    .click();
  await expect(live.getByText(/^Sent: 0 · Unchanged: \d+ · Removed: 0$/)).toBeVisible({
    timeout: 60_000,
  });
  await app?.close();
  app = undefined;

  // Each publish kept the version it went live with, recording where it went.
  const store = ProjectStore.open(path, { readOnly: true });
  try {
    const versions = store.listVersions().filter(({ reason }) => reason === "on-publish");
    expect(versions.length).toBeGreaterThanOrEqual(1);
    expect(versions[0]).toMatchObject({
      publishedTo: expect.objectContaining({ check: "unchecked" }),
    });
    // And when it last went live, for the year Site Check says it shows (F-CM-8).
    expect(store.readLastPublishedAt()).toBe(versions[0]?.publishedTo?.publishedAt);
  } finally {
    store.close();
  }
});

test("republishes an earlier version, the site as it is left be, and says where it went (4.6b)", async () => {
  test.skip(
    process.platform !== "win32" && process.platform !== "darwin",
    "the OS keychain is Windows' and macOS's (ADR 0006 §5)",
  );
  server = await startSftpServer({ user: "baker", password: PASSWORD });
  // A site with an About page, which the person deletes after saving a version with it.
  const path = join(dir, "Rosa's Bakery.wforge");
  const created = ProjectStore.create(path, { name: "Rosa's Bakery" });
  const site = createSite({
    name: "Rosa's Bakery",
    language: "en",
    homeTitle: "Home",
    notFoundTitle: "Not found",
  });
  site.settings.address.url = "https://www.rosas-bakery.example";
  const home = site.pages[site.homePageId];
  if (home === undefined) throw new Error("no home page");
  const about = "page-about" as PageId;
  site.pages[about] = { ...structuredClone(home), id: about, slug: "about", title: "About" };
  site.pageOrder.splice(1, 0, about);
  created.saveSite(site);
  created.close();

  const page = await openPublish(path);
  await addTestHost(page, server);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Publish" })).toBeHidden();

  await page.keyboard.press("ControlOrMeta+Alt+s");
  const naming = page.getByRole("dialog", { name: "Save Version" });
  await naming.getByLabel("Version name").fill("With About");
  await naming.getByRole("button", { name: "Save Version" }).click();
  await expect(naming).toHaveCount(0);
  await page
    .getByRole("region", { name: "Right panels" })
    .getByRole("tab", { name: "Site" })
    .click();
  const pages = page.getByRole("list", { name: "Pages" });
  await pages.getByRole("button", { name: "Actions for About" }).click();
  await page.getByRole("menuitem", { name: "Delete…" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete Page" }).click();
  await expect(pages.getByRole("button", { name: /^About/ })).toHaveCount(0);

  // The site as it is, without About, goes live first.
  const live = page.getByRole("dialog", { name: "Your site is live" });
  await page.getByRole("button", { name: "Publish…", exact: true }).click();
  await page
    .getByRole("dialog", { name: "Publish" })
    .getByRole("button", { name: "Publish to Test host" })
    .click();
  await expect(live).toBeVisible({ timeout: 60_000 });
  await live.getByRole("button", { name: "Done" }).click();
  expect(existsSync(join(server.site, "index.html"))).toBe(true);
  expect(existsSync(join(server.site, "about.html"))).toBe(false);

  // Then the version with About, from Version History.
  await page
    .getByRole("region", { name: "Left panels" })
    .getByRole("tab", { name: "Version History" })
    .click();
  const versions = page.getByRole("list", { name: "Versions" });
  await versions.getByRole("button", { name: "More for “With About”" }).click();
  await page.getByRole("menuitem", { name: "Republish…" }).click();
  await page
    .getByRole("dialog", { name: "Republish “With About”" })
    .getByRole("button", { name: "Republish to Test host" })
    .click();
  await expect(live).toBeVisible({ timeout: 60_000 });
  await live.getByRole("button", { name: "Done" }).click();

  // On the host: the version's About page. In the editor: still none.
  expect(readFileSync(join(server.site, "about.html"), "utf8")).toContain("About");
  await expect(pages.getByRole("button", { name: /^About/ })).toHaveCount(0);
  // The version says where it went; republishing saved no version of its own.
  const withAbout = versions.getByRole("listitem").filter({ hasText: "With About" });
  await expect(withAbout).toContainText("Published to Test host");
  await app?.close();
  app = undefined;

  const store = ProjectStore.open(path, { readOnly: true });
  try {
    const listed = store.listVersions();
    expect(listed.filter(({ reason }) => reason === "on-publish")).toHaveLength(1);
    const republished = listed.find(({ name }) => name === "With About");
    expect(republished?.publishedTo).toMatchObject({ check: "unchecked" });
    expect(store.readLastPublishedAt()).toBe(republished?.publishedTo?.publishedAt);
  } finally {
    store.close();
  }
});
