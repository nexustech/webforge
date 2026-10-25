import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type ElectronApplication, expect, test } from "@playwright/test";
import { ProjectStore } from "@webforge/storage";
import { launchDesktopApp, waitForCanvas } from "./launch.js";
import { chooseFromMenu } from "./menus.js";
import { stubFileDialogs } from "./sites.js";

// Site Settings (1.17, F-SET-1): opened from the File menu, checked on Save, saved as one undo
// step, and kept in the site file; elements bound to a value show it on the canvas and in the
// export.

let dir: string;
let sitePath: string;
let app: ElectronApplication | undefined;

test.beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "webforge-settings-"));
  sitePath = join(dir, "Settings.wforge");
  ProjectStore.create(sitePath, { name: "Settings" }).close();
});

test.afterEach(async () => {
  await app?.close();
  app = undefined;
  rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
});

test("edits Site Settings from the File menu, fixing what Save points at, as one undo step", async () => {
  app = await launchDesktopApp({ args: [sitePath] });
  const page = await app.firstWindow();
  const status = page.getByRole("banner").getByRole("status");
  await expect(status).toHaveText("Saved", { timeout: 30_000 });

  await chooseFromMenu(app as ElectronApplication, page, "File", "Site Settings…");
  const dialog = page.getByRole("dialog", { name: "Settings", exact: true });
  await dialog.getByLabel("Site name").fill("Rosa's Bakery");
  await dialog.getByRole("tab", { name: "Contact & hours" }).click();
  await dialog.getByLabel("Phone number").fill("call us");
  await dialog.getByRole("tab", { name: "General" }).click();
  await dialog.getByRole("button", { name: "Save" }).click();

  // Save points at the phone number, on its own section, in words a person can act on.
  await expect(dialog.getByText("Use a phone number such as +44 1234 567890.")).toBeVisible();
  await dialog.getByLabel("Phone number").fill("+44 1234 567890");
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog).toHaveCount(0);

  await page.getByRole("tab", { name: "Undo History" }).click();
  await expect(page.locator(".undo-history__step").first()).toHaveText(
    "Changed Site Settings: General, Contact & hours",
  );
  await expect(status).toHaveText("Saved", { timeout: 10_000 });

  await app.close();
  app = undefined;
  const store = ProjectStore.open(sitePath, { readOnly: true });
  try {
    expect(store.readSite().settings).toMatchObject({
      general: { name: "Rosa's Bakery" },
      contact: { phone: "+44 1234 567890" },
    });
  } finally {
    store.close();
  }
});

test("Ctrl/Cmd+Z in Site Settings' text undoes the text, not the site's last step (#421 review)", async () => {
  app = await launchDesktopApp({ args: [sitePath] });
  const page = await app.firstWindow();
  await expect(page.getByRole("banner").getByRole("status")).toHaveText("Saved", {
    timeout: 30_000,
  });
  const dialog = page.getByRole("dialog", { name: "Settings", exact: true });
  const name = dialog.getByLabel("Site name");
  // A step of the site's own to undo, if the keys went to the site.
  await chooseFromMenu(app, page, "File", "Site Settings…");
  await name.fill("Rosa's");
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog).toHaveCount(0);

  await chooseFromMenu(app, page, "File", "Site Settings…");
  await name.click();
  await name.press("End");
  await name.pressSequentially(" Bakery", { delay: 20 });
  await expect(name).toHaveValue("Rosa's Bakery");
  await page.keyboard.press("ControlOrMeta+z");
  await expect(name).not.toHaveValue("Rosa's Bakery");
  // An email field too, whose caret browsers don't report (#425 review).
  await dialog.getByRole("tab", { name: "Contact & hours" }).click();
  const email = dialog.getByLabel("Email address", { exact: true });
  await email.click();
  await email.pressSequentially("hi@rosas.co", { delay: 20 });
  await page.keyboard.press("ControlOrMeta+z");
  await expect(email).not.toHaveValue("hi@rosas.co");
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toHaveCount(0);

  // The site kept its step: its name is still the saved one.
  await chooseFromMenu(app, page, "File", "Site Settings…");
  await expect(name).toHaveValue("Rosa's");
});

test("shows Site Settings values in bound elements, on the canvas and in the export", async () => {
  app = await launchDesktopApp();
  const page = await app.firstWindow();
  const canvas = page.frameLocator(".editor__canvas iframe");
  const panel = page.getByRole("region", { name: "Right panels" });
  await waitForCanvas(page);
  // Undo History is the left column's second tab, after Add.
  await page
    .getByRole("region", { name: "Left panels" })
    .getByRole("tab", { name: "Undo History" })
    .click();

  // Select the heading by clicking past the end of its text (clicking the text edits it).
  const heading = canvas.locator(".site-heading");
  const box = await heading.boundingBox();
  if (box === null) throw new Error("Heading not visible");
  await heading.click({ position: { x: box.width * 0.97, y: 2 } });
  await panel.getByLabel("Text shows").selectOption("contact.phone");

  // Until the phone number is added, the canvas says where to add it.
  await page.getByRole("tab", { name: "Undo History" }).click();
  await expect(page.locator(".undo-history__step").first()).toHaveText(
    "Heading shows Phone number",
  );
  await expect(heading).toHaveText("Add your phone number in Site Settings");

  await chooseFromMenu(app as ElectronApplication, page, "File", "Site Settings…");
  const dialog = page.getByRole("dialog", { name: "Settings", exact: true });
  await dialog.getByLabel("Site name").fill("Hightown Bakery");
  await dialog.getByRole("tab", { name: "Contact & hours" }).click();
  await dialog.getByLabel("Phone number").fill("+44 1234 567890");
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog).toHaveCount(0);

  await expect(heading).toHaveText("+44 1234 567890");

  const folder = join(dir, "export");
  await stubFileDialogs(app, folder);
  await page.getByRole("button", { name: "Export Site…", exact: true }).click();
  await expect(page.getByText(/Site exported to/)).toBeVisible({ timeout: 30_000 });
  const index = readFileSync(join(folder, "index.html"), "utf8");
  // A new site's Header shows the site name (the canvas doesn't show the Header yet).
  expect(index).toMatch(/<header class="site-header[\s\S]*Hightown Bakery[\s\S]*<\/header>/);
  expect(index).toContain("+44 1234 567890");
  expect(index).not.toContain("Welcome to our business");
  expect(index).not.toContain("Site Settings");
});

test("lists Site Settings' opening hours and contact details, on the canvas and in the export (2.8)", async () => {
  app = await launchDesktopApp();
  const page = await app.firstWindow();
  const canvas = page.frameLocator(".editor__canvas iframe");
  await waitForCanvas(page);
  await page
    .getByRole("region", { name: "Left panels" })
    .getByRole("button", { name: "Opening hours and contact", exact: true })
    .click();
  const section = canvas.locator(".site-contact");
  // Until Site Settings have them, the canvas says where to add them.
  await expect(section).toContainText("Add your phone number in Site Settings");

  await chooseFromMenu(app as ElectronApplication, page, "File", "Site Settings…");
  const dialog = page.getByRole("dialog", { name: "Settings", exact: true });
  await dialog.getByRole("tab", { name: "Contact & hours" }).click();
  await dialog.getByLabel("Phone number").fill("+44 1234 567890");
  await dialog.getByRole("button", { name: "Add opening hours" }).click();
  // Each day is a button-like label around a hidden checkbox, clicked as people do.
  for (const day of ["Sat", "Sun"]) {
    await dialog.locator("label", { hasText: new RegExp(`^${day}$`) }).click();
    await expect(dialog.getByRole("checkbox", { name: day })).toBeChecked();
  }
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog).toHaveCount(0);

  // The section follows Site Settings at once: the hours, and the phone number as a link.
  await expect(section.locator("dt")).toHaveText(["Saturday and Sunday"]);
  // In the site's language: a new site is in English (en), so 12-hour times.
  await expect(section.locator("dd")).toHaveText([/^9:00\sAM–5:00\sPM$/]);
  await expect(section.getByRole("link", { name: "+44 1234 567890" })).toBeVisible();

  const folder = join(dir, "export");
  await stubFileDialogs(app, folder);
  await page.getByRole("button", { name: "Export Site…", exact: true }).click();
  await expect(page.getByText(/Site exported to/)).toBeVisible({ timeout: 30_000 });
  const index = readFileSync(join(folder, "index.html"), "utf8");
  expect(index).toContain('<dt class="font-medium">Saturday and Sunday</dt>');
  expect(index).toContain('href="tel:+441234567890"');
  // An empty email address leaves its line out, and no hint reaches the site.
  expect(index).not.toContain("Email:");
  expect(index).not.toContain("Site Settings");
});
