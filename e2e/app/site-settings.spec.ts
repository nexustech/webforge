import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type ElectronApplication, expect, test } from "@playwright/test";
import { ProjectStore } from "@webforge/storage";
import { launchDesktopApp, waitForCanvas } from "./launch.js";
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

  await page.getByRole("menuitem", { name: "File" }).click();
  await page.getByRole("menuitem", { name: "Site Settings…" }).click();
  const dialog = page.getByRole("dialog", { name: "Site Settings" });
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

  await page.getByRole("menuitem", { name: "File" }).click();
  await page.getByRole("menuitem", { name: "Site Settings…" }).click();
  const dialog = page.getByRole("dialog", { name: "Site Settings" });
  await dialog.getByLabel("Site name").fill("Hightown Bakery");
  await dialog.getByRole("tab", { name: "Contact & hours" }).click();
  await dialog.getByLabel("Phone number").fill("+44 1234 567890");
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog).toHaveCount(0);

  await expect(heading).toHaveText("+44 1234 567890");

  const folder = join(dir, "export");
  await stubFileDialogs(app, folder);
  await page.getByRole("button", { name: "Export", exact: true }).click();
  await expect(page.getByText(/Site exported to/)).toBeVisible({ timeout: 30_000 });
  const index = readFileSync(join(folder, "index.html"), "utf8");
  // A new site's Header shows the site name (the canvas doesn't show the Header yet).
  expect(index).toMatch(/<header class="site-header[\s\S]*Hightown Bakery[\s\S]*<\/header>/);
  expect(index).toContain("+44 1234 567890");
  expect(index).not.toContain("Welcome to our business");
  expect(index).not.toContain("Site Settings");
});
