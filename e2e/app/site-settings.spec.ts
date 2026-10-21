import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type ElectronApplication, expect, test } from "@playwright/test";
import { ProjectStore } from "@webforge/storage";
import { launchDesktopApp } from "./launch.js";

// Site Settings (1.17, F-SET-1): opened from the File menu, checked on Save, saved as one undo
// step, and kept in the site file.

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
  await expect(page.locator(".undo-history__step").first()).toHaveText("Changed Site Settings");
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
