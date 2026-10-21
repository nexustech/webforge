import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type ElectronApplication, expect, type Page, test } from "@playwright/test";
import { launchDesktopApp } from "./launch.js";
import { stubFileDialogs } from "./sites.js";

// Layers (1.24, F-ED-12): Advanced mode only; selection in step with the canvas both ways; a move
// or a hide is one undo step.

const STARTER_HEADING = "Welcome to our business";
const STARTER_TEXT = "Tell visitors what you do and why they will love it.";

let app: ElectronApplication;
let page: Page;

test.beforeEach(async () => {
  app = await launchDesktopApp();
  page = await app.firstWindow();
  await expect(canvas().locator("h1")).toHaveText(STARTER_HEADING);
});

test.afterEach(async () => {
  await app.close();
});

const canvas = () => page.frameLocator(".editor__canvas iframe");
const left = () => page.getByRole("region", { name: "Left panels" });
const tree = () => left().getByRole("tree", { name: "Layers" });
const row = (name: string) => tree().getByRole("treeitem", { name: new RegExp(`^${name}`) });
/** The label of Puck's action bar, which names the selected element. */
const selected = () => canvas().locator('[class*="ActionBar-label"]');
const steps = () => page.locator(".undo-history__step");

async function switchToAdvancedMode(): Promise<void> {
  await page.getByRole("menuitem", { name: "View" }).click();
  await page.getByRole("menuitem", { name: "Use Advanced Mode" }).click();
}

test("Layers shows in Advanced mode only, and selects in step with the canvas", async () => {
  await expect(left().getByRole("tab", { name: "Layers" })).toHaveCount(0);
  await switchToAdvancedMode();
  await left().getByRole("tab", { name: "Layers" }).click();
  await expect(row("Section")).toBeVisible();

  // Canvas → Layers, first: with nothing selected yet, no action bar covers the text.
  await canvas().getByText(STARTER_TEXT).click();
  await expect(selected()).toHaveText("Text");
  await expect(row("Text")).toHaveAttribute("aria-selected", "true");

  // Layers → canvas.
  await row("Heading").click();
  await expect(selected()).toHaveText("Heading");
  await expect(row("Text")).toHaveAttribute("aria-selected", "false");
});

test("moves a layer with Alt+↓ and hides one, each as one undo step", async () => {
  await switchToAdvancedMode();
  await left().getByRole("tab", { name: "Layers" }).click();

  await row("Heading").click();
  await row("Heading").press("Alt+ArrowDown");
  await expect(canvas().locator(".site-section")).toContainText(
    `${STARTER_TEXT}${STARTER_HEADING}`,
  );

  await row("Text").hover();
  await tree().getByRole("button", { name: "Hide Text" }).click();
  await expect(tree().getByRole("button", { name: "Show Text" })).toBeVisible();

  await left().getByRole("tab", { name: "Undo History" }).click();
  await expect(steps()).toHaveText(["Hid Text", "Moved Heading", "Opened page"]);
});

test("leaves a hidden layer out of the exported site (F-ED-12)", async () => {
  const parent = mkdtempSync(join(tmpdir(), "webforge-e2e-layers-"));
  try {
    await switchToAdvancedMode();
    await left().getByRole("tab", { name: "Layers" }).click();
    await row("Heading").hover();
    await tree().getByRole("button", { name: "Hide Heading" }).click();

    const folder = join(parent, "site");
    await stubFileDialogs(app, folder);
    await page.getByRole("button", { name: "Export", exact: true }).click();
    await expect(page.getByText(/^Site exported to/)).toBeVisible({ timeout: 30_000 });

    const index = readFileSync(join(folder, "index.html"), "utf8");
    expect(index).not.toContain(STARTER_HEADING);
    expect(index).toContain(STARTER_TEXT);
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});
