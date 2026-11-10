import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type ElectronApplication, expect, type Page, test } from "@playwright/test";
import { ACTION_BAR_LABEL, SELECTED_COMPONENT } from "@webforge/engine/puck-dom";
import { clickOnCanvas } from "./canvas-click.js";
import { launchDesktopApp, waitForCanvas } from "./launch.js";
import { chooseFromMenu } from "./menus.js";
import { exportFromEditor, stubFileDialogs } from "./sites.js";

// Layers (1.24, F-ED-12): always shown under Add and Undo History, in Simple and Advanced mode
// (ADR 0011), read-only in Content mode; selection in step with the canvas both ways; a move or a
// hide is one undo step. A row's eye shows, hides while editing or doesn't publish (UX-23, #864).

const STARTER_HEADING = "Welcome to our business";
const STARTER_TEXT = "Tell visitors what you do and why they will love it.";

let app: ElectronApplication;
let page: Page;

test.beforeEach(async () => {
  app = await launchDesktopApp();
  page = await app.firstWindow();
  await waitForCanvas(page);
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
// The selected element's name, in its bar: a hovered element's chip is a label too (SP-1).
const selected = () => canvas().locator(`${SELECTED_COMPONENT} ${ACTION_BAR_LABEL}`);
const steps = () => page.locator(".undo-history__step");

/**
 * Shows `item`, which shows as `now`, as `choice` says, from its row's eye (UX-23): the row named
 * `item` unless `on` is given (the Header's row starts with *On every page*).
 */
async function setShown(item: string, now: string, choice: string, on = row(item)): Promise<void> {
  await on.hover();
  await tree()
    .getByRole("button", { name: `Show or hide ${item} (now: ${now})` })
    .click();
  await page.getByRole("menuitemradio", { name: choice }).click();
}

/** Runs a View menu command, once a menu an earlier one closed has gone. */
async function viewMenu(name: string): Promise<void> {
  await expect(page.getByRole("menu")).toHaveCount(0);
  await chooseFromMenu(app, page, "View", name);
}

test("Layers shows with Add in Simple mode, and selects in step with the canvas", async () => {
  // A new window, in Simple mode: Layers and the Add panel at the same time (ADR 0011).
  await expect(row("Section")).toBeVisible();
  await expect(left().getByRole("tab", { name: "Add" })).toHaveAttribute("aria-selected", "true");
  await expect(left().getByRole("tabpanel", { name: "Add" })).toBeVisible();
  // Through Advanced mode and back, it stays.
  await viewMenu("Use Advanced Mode");
  await expect(row("Section")).toBeVisible();
  await viewMenu("Use Simple Mode");
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

test("moves a layer with Ctrl/Cmd+Alt+↓ and hides one, each as one undo step", async () => {
  await expect(row("Section")).toBeVisible();

  await row("Heading").click();
  await row("Heading").press("ControlOrMeta+Alt+ArrowDown");
  await expect(canvas().locator(".site-section")).toContainText(
    `${STARTER_TEXT}${STARTER_HEADING}`,
  );

  await setShown("Text", "Show", "Don't publish");
  await expect(
    tree().getByRole("button", { name: "Show or hide Text (now: Don't publish)" }),
  ).toBeVisible();
  // Still on the canvas, dimmed (#141), but left out of the export.
  const text = canvas().locator(".site-text");
  await expect(text).toHaveAttribute("data-webforge-hidden", "");
  await expect(text).toHaveCSS("opacity", "0.35");

  await left().getByRole("tab", { name: "Undo History" }).click();
  await expect(steps()).toHaveText(["Kept Text off your website", "Moved Heading", "Opened page"]);
});

test("lists the shared Header first and Footer last; the Header's eye hides it on this page (#673)", async () => {
  const rows = tree().getByRole("treeitem");
  await expect(rows.first()).toContainText("Header");
  await expect(rows.first()).toContainText("On every page");
  await expect(rows.last()).toContainText("Footer");

  // Layers → canvas, and back.
  await rows.last().click();
  await expect(selected()).toHaveText("Footer");
  await clickOnCanvas(canvas().locator(".site-header"), { position: { x: 4, y: 4 } });
  await expect(rows.first()).toHaveAttribute("aria-selected", "true");

  // Its eye is the page's Hide the Header on this page: gone from the canvas, one step.
  await setShown("Header", "Show", "Don't publish", rows.first());
  await expect(canvas().locator(".site-header")).toHaveCount(0);
  await expect(
    tree().getByRole("button", { name: "Show or hide Header (now: Don't publish)" }),
  ).toBeVisible();
  await left().getByRole("tab", { name: "Undo History" }).click();
  await expect(steps().first()).toHaveText("Hid the Header on this page");
  await page.keyboard.press("ControlOrMeta+z");
  await expect(canvas().locator(".site-header")).toHaveCount(1);
});

test("leaves out of the export a layer not published, and a draft page, but not one hidden while editing (UX-23, G37)", async () => {
  const parent = mkdtempSync(join(tmpdir(), "webforge-e2e-layers-"));
  try {
    await expect(row("Section")).toBeVisible();
    await setShown("Heading", "Show", "Don't publish");
    // Hidden while editing: gone from the canvas, still exported.
    await setShown("Text", "Show", "Hide while editing");
    await expect(canvas().locator(".site-text")).toHaveCount(0);
    await expect(canvas().locator("h1")).toHaveText(STARTER_HEADING);

    // A draft page (G37): added, then made a draft from its menu in the Pages panel.
    await page
      .getByRole("region", { name: "Right panels" })
      .getByRole("tab", { name: "Site" })
      .click();
    await page.getByRole("button", { name: "Add Page" }).click();
    await page.getByRole("menuitem", { name: "Blank Page…" }).click();
    await page.getByRole("textbox", { name: "Page name" }).fill("Winter menu");
    await page.getByRole("dialog").getByRole("button", { name: "Add Page" }).click();
    await page
      .getByRole("list", { name: "Pages" })
      .getByRole("button", { name: "Actions for Winter menu" })
      .click();
    await page.getByRole("menuitemcheckbox", { name: "Draft" }).click();
    await expect(page.getByRole("button", { name: /^Winter menu Draft/ })).toBeVisible();
    await left().getByRole("tab", { name: "Undo History" }).click();
    await expect(steps().first()).toHaveText("Made 'Winter menu' a draft");

    const folder = join(parent, "site");
    await stubFileDialogs(app, folder);
    await exportFromEditor(page);

    const index = readFileSync(join(folder, "index.html"), "utf8");
    expect(index).not.toContain(STARTER_HEADING);
    expect(index).toContain(STARTER_TEXT);
    expect(readdirSync(folder)).not.toContain("winter-menu.html");
    expect(index).not.toContain("Winter menu");
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});

test("shows Layers in Content mode too, where nothing can be moved or hidden", async () => {
  await page.getByRole("radio", { name: "Content" }).click();

  await expect(row("Heading")).toBeVisible();
  await row("Heading").hover();
  await expect(
    tree().getByRole("button", { name: "Show or hide Heading (now: Show)" }),
  ).toBeDisabled();
  const order = await tree().getByRole("treeitem").allInnerTexts();
  await row("Heading").click();
  await page.keyboard.press("Alt+ArrowDown");
  await expect(tree().getByRole("treeitem")).toHaveText(order);
});
