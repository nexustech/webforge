import { type ElectronApplication, expect, type Page, test } from "@playwright/test";
import { launchDesktopApp, waitForCanvas } from "./launch.js";

// Site Check (3.6, F-CHK-1): the bottom drawer's panel checks the open site as it changes. A
// finding jumps to where it is; some have a Fix; Should fix and Tips can be ignored for the site.

let app: ElectronApplication;
let page: Page;

test.beforeEach(async () => {
  app = await launchDesktopApp();
  page = await app.firstWindow();
  await waitForCanvas(page);
  await page.getByRole("button", { name: "Show or Hide Bottom Panel" }).click();
});

test.afterEach(async () => {
  await app.close();
});

const drawer = () => page.getByRole("region", { name: "Bottom panel" });
const rule = (id: string) => drawer().locator(`[data-rule="${id}"]`);

test("lists the new site's placeholder text, and selects it from there", async () => {
  await expect(drawer().getByRole("tab", { name: "Site Check" })).toBeVisible();
  // What passed, in one group after the problems (#1164).
  await expect(drawer().getByText(/^Passed \(\d+\)$/)).toBeVisible();
  // The starter page's text asks the owner to write their own.
  await expect(rule("placeholders")).toHaveAttribute("data-status", "warn");
  await expect(rule("deviceNames")).toHaveAttribute("data-status", "pass");

  const panel = page.getByRole("region", { name: "Right panels" });
  await expect(panel.getByText("Select an element to edit it")).toBeVisible();
  await rule("placeholders")
    .getByRole("button", { name: /^Show Text on / })
    .click();

  // Selected: the Edit panel shows it.
  await expect(panel.getByRole("heading", { name: "Text", exact: true })).toBeVisible();
});

test("its title-bar button says what it found, and opens it (#1009)", async () => {
  const button = page.getByRole("banner").getByRole("button", { name: /^Site Check: / });
  // The starter site's placeholder text, at least, is still to fix.
  await expect(button).toHaveAccessibleName(/^Site Check: \d+ to fix/);
  const before = await button.getAttribute("aria-label");

  // Ignoring a finding counts one fewer.
  await rule("placeholders")
    .getByRole("button", { name: /^Ignore/ })
    .first()
    .click();
  await expect(button).not.toHaveAccessibleName(before ?? "");

  await page.getByRole("button", { name: "Show or Hide Bottom Panel" }).click();
  await expect(drawer()).toBeHidden();
  await button.click();
  await expect(drawer().getByRole("tab", { name: "Site Check", selected: true })).toBeVisible();
});

for (const [width, height] of [
  [1366, 768],
  [960, 600],
] as const) {
  test(`opens from the title bar's count at a height to read, problems first, at ${width} × ${height} (#1164)`, async () => {
    // The drawer closed, as a new person's is, and the window this size.
    await page.getByRole("button", { name: "Show or Hide Bottom Panel" }).click();
    await expect(drawer()).toBeHidden();
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.unmaximize());
    await app.evaluate(
      ({ BrowserWindow }, size) => BrowserWindow.getAllWindows()[0]?.setContentSize(...size),
      [width, height] as [number, number],
    );
    await expect.poll(() => page.evaluate(() => window.innerHeight)).toBe(height);

    await page
      .getByRole("banner")
      .getByRole("button", { name: /^Site Check: / })
      .click();

    // At least three findings in view at once: it opened at 73 px, its tabs and one line.
    await expect(drawer().getByRole("tab", { name: "Site Check", selected: true })).toBeVisible();
    const shown = await drawer().boundingBox();
    if (shown === null) throw new Error("no drawer");
    const findings = drawer().getByRole("button", { name: /^Show / });
    await expect
      .poll(async () => {
        let inView = 0;
        for (const box of await Promise.all((await findings.all()).map((f) => f.boundingBox()))) {
          if (box !== null && box.y >= shown.y && box.y + box.height <= shown.y + shown.height) {
            inView += 1;
          }
        }
        return inView;
      })
      .toBeGreaterThanOrEqual(3);

    // No passed rule above the last problem.
    const statuses = await drawer()
      .locator("[data-rule]")
      .evaluateAll((rows) => rows.map((row) => row.getAttribute("data-status")));
    const lastProblem = statuses.findLastIndex((status) => status !== "pass");
    expect(lastProblem).toBeGreaterThan(-1);
    expect(statuses.slice(0, lastProblem).includes("pass")).toBe(false);

    // Each Fix named for what it fixes, no two alike.
    const fixes = await drawer()
      .getByRole("button", { name: /^Fix/ })
      .evaluateAll((buttons) => buttons.map((button) => button.getAttribute("aria-label")));
    expect(fixes.length).toBeGreaterThan(0);
    expect(fixes.every((name) => name?.startsWith("Fix: "))).toBe(true);
    expect(new Set(fixes).size).toBe(fixes.length);
  });
}

test("says what a Fix did, and undoes it from there (#1164)", async () => {
  // A Contact form collects details, so the site needs a privacy page; its Fix adds one.
  await page.getByRole("region", { name: "Left panels" }).getByRole("tab", { name: "Add" }).click();
  await page
    .getByRole("region", { name: "Left panels" })
    .getByRole("button", { name: "Contact form", exact: true })
    .click();
  await rule("privacyPage")
    .getByRole("button", { name: /^Fix: / })
    .click();

  const toast = page.locator("[data-sonner-toast]").filter({ hasText: "Added page 'Privacy'" });
  await expect(toast).toBeVisible();
  const privacy = page
    .getByRole("list", { name: "Pages" })
    .getByRole("button", { name: /^Privacy/ });
  await expect(privacy).toBeVisible();
  await toast.getByRole("button", { name: "Undo" }).click();
  await expect(privacy).toHaveCount(0);
});

test("ignores a finding, and brings it back", async () => {
  const before = await rule("placeholders")
    .getByRole("button", { name: /^Show / })
    .count();
  await rule("placeholders")
    .getByRole("button", { name: /^Ignore/ })
    .first()
    .click();

  await expect(rule("placeholders").getByRole("button", { name: /^Show / })).toHaveCount(
    before - 1,
  );
  await drawer().getByRole("button", { name: "Show 1 ignored item again" }).click();
  await expect(rule("placeholders").getByRole("button", { name: /^Show / })).toHaveCount(before);
});

test("opens Site Settings at the web address from its Fix", async () => {
  await rule("webAddress")
    .getByRole("button", { name: /^Fix: / })
    .click();

  await expect(page.getByRole("dialog", { name: "Settings", exact: true })).toBeVisible();
});

test("opens Page Settings on a page without a description, in Being found (3.17)", async () => {
  await expect(drawer().getByRole("region", { name: "Being found" })).toBeVisible();
  // The new site's home page has no description, nor has the site.
  await rule("pageDescriptions")
    .getByRole("button", { name: /^Fix: / })
    .first()
    .click();

  await expect(page.getByRole("dialog", { name: /^Settings for '/ })).toBeVisible();
});

test("lists a note added from the element menu as a tip, outlined on the page, until it's resolved (UX-17)", async () => {
  const tree = page
    .getByRole("region", { name: "Left panels" })
    .getByRole("tree", { name: "Layers" });
  const heading = tree.getByRole("treeitem", { name: /^Heading/ });
  const canvas = page.frameLocator(".editor__canvas iframe");
  await expect(rule("notes")).toHaveAttribute("data-status", "pass");

  await heading.click({ button: "right" });
  await page.getByRole("menu").getByRole("menuitem", { name: "Add Note…" }).click();
  const dialog = page.getByRole("dialog", { name: "Note on Heading" });
  await dialog.getByRole("textbox", { name: "Note" }).fill("Swap this photo before launch");
  await dialog.getByRole("button", { name: "Save Note" }).click();

  await expect(rule("notes")).toHaveAttribute("data-status", "warn");
  await expect(rule("notes")).toContainText("Swap this photo before launch");
  await expect(canvas.locator("h1[data-webforge-note]")).toHaveCount(1);
  await expect(heading).toContainText("has a note");
  await expect(heading).toHaveAttribute("aria-description", "Swap this photo before launch");

  await heading.click({ button: "right" });
  await page.getByRole("menu").getByRole("menuitem", { name: "Resolve Note" }).click();
  await expect(rule("notes")).toHaveAttribute("data-status", "pass");
  await expect(canvas.locator("h1[data-webforge-note]")).toHaveCount(0);
});
