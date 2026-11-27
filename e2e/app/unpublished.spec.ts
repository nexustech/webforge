import { type ElectronApplication, expect, type Page, test } from "@playwright/test";
import { launchDesktopApp, waitForCanvas } from "./launch.js";

// Elements set to Don't Publish (#1512): the canvas's badge, Layers, Preview's message, the Publish
// dialog and Site Check name the same ones, the outermost only, so a section left out with
// elements left out inside it counts once. Show, from Preview, Publish or Site Check, selects it,
// from another page too, and in Content mode, where showing it again stays the layout's.

let app: ElectronApplication;
let page: Page;

test.beforeEach(async () => {
  app = await launchDesktopApp();
  page = await app.firstWindow();
  await waitForCanvas(page);
  // The addresses Preview would open in the default browser, instead of opening them.
  await app.evaluate(({ shell }) => {
    Object.assign(shell, { openExternal: async () => undefined });
  });
});

test.afterEach(async () => {
  await app.close();
});

const canvas = () => page.frameLocator(".editor__canvas iframe");
const left = () => page.getByRole("region", { name: "Left panels" });
const tree = () => left().getByRole("tree", { name: "Layers" });
const row = (name: string) => tree().getByRole("treeitem", { name: new RegExp(`^${name}`) });
const drawer = () => page.getByRole("region", { name: "Bottom panel" });
const unpublishedTip = () => drawer().locator('[data-rule="unpublished"]');
const toolbar = () => page.getByRole("toolbar", { name: "Canvas" });
const editPanel = () => page.getByRole("region", { name: "Right panels" });

/** Sets `item` to Don't Publish from its row's eye in Layers (UX-23). */
async function dontPublish(item: string): Promise<void> {
  await row(item).hover();
  await tree()
    .getByRole("button", { name: `Shown. Choose whether ${item} shows…` })
    .click();
  await page.getByRole("menuitemradio", { name: "Don't Publish" }).click();
  await expect(
    tree().getByRole("button", { name: `Not published. Choose whether ${item} shows…` }),
  ).toBeVisible();
}

/** The badges the canvas shows: one inside an element left out is hidden by its CSS. */
const shownBadges = () =>
  canvas().locator(".wf-unpublished").filter({ visible: true }).getByRole("button", {
    name: "Not published: left out of your website",
  });

/** The rows Layers marks as left out themselves: their eye crossed, not dimmed for a parent's. */
const outermostRows = () =>
  tree()
    .getByRole("treeitem")
    .filter({ has: page.getByRole("button", { name: /^Not published\. Choose whether / }) })
    .filter({ hasNotText: "as it's inside an element that isn't" });

/** The toasts showing, not one closing, which Sonner keeps a moment as it leaves. */
const toasts = () => page.locator('[data-sonner-toast]:not([data-removed="true"])');

/** Opens Preview, and gives the toast that says it opened. */
async function openPreview() {
  await page.getByRole("banner").getByRole("button", { name: "Preview", exact: true }).click();
  const toast = toasts().filter({ hasText: "Opened in your browser" });
  await expect(toast).toBeVisible();
  return toast;
}

/** Opens Publish, and gives its dialog once its destinations are read. */
async function openPublish() {
  await page.getByRole("banner").getByRole("button", { name: "Publish", exact: true }).click();
  return page.getByRole("dialog", { name: "Publish", exact: true });
}

test("the badge, Layers, Preview, Publish and Site Check name the same elements, a section once (#1512)", async () => {
  await page.getByRole("button", { name: "Show or Hide Bottom Panel" }).click();
  await expect(row("Section")).toBeVisible();

  // Two elements in a section that's shown: two each.
  await dontPublish("Heading");
  await dontPublish("Text");
  await expect(shownBadges()).toHaveCount(2);
  await expect(outermostRows()).toHaveCount(2);
  await expect(unpublishedTip().getByRole("button", { name: /^Show / })).toHaveCount(2);
  const toast = await openPreview();
  await expect(toast).toContainText(
    "2 elements on this page aren't published, so the preview leaves them out",
  );
  // It waits to be closed: left open here, the next Preview's replaces it.
  const publish = await openPublish();
  await expect(publish).toContainText(
    "2 elements aren't published, so they won't be on your website.",
  );
  await page.keyboard.press("Escape");
  await expect(publish).toHaveCount(0);

  // The section around them left out too: it alone, everywhere.
  await dontPublish("Section");
  await expect(shownBadges()).toHaveCount(1);
  await expect(outermostRows()).toHaveCount(1);
  await expect(outermostRows()).toContainText("Section");
  const findings = unpublishedTip().getByRole("button", { name: /^Show / });
  await expect(findings).toHaveCount(1);
  await expect(findings).toHaveAccessibleName(/^Show Section on /);
  await expect(unpublishedTip()).toContainText("1 element isn't published");
  const again = await openPreview();
  await expect(again).toContainText(
    "1 element on this page isn't published, so the preview leaves it out",
  );
  // One at a time, with today's count: the first one's 2 has gone.
  const counts = toasts().filter({ hasText: /published, so the preview/ });
  await expect(counts).toHaveCount(1);
  // A page that leaves nothing out takes it away.
  await toolbar().getByRole("combobox", { name: "Page shown" }).selectOption("Page not found");
  await expect(canvas().locator("h1")).toHaveText("Sorry, this page doesn't exist");
  // Sonner closes the old one a frame after showing the new one, so this counts rather than
  // asking for the one toast, which a strict match would fail at once.
  await page.getByRole("banner").getByRole("button", { name: "Preview", exact: true }).click();
  await expect(counts).toHaveCount(0);
  await expect(toasts().filter({ hasText: "Opened in your browser" })).toHaveCount(1);
  await toolbar().getByRole("combobox", { name: "Page shown" }).selectOption({ index: 0 });
  const publishAgain = await openPublish();
  await expect(publishAgain).toContainText(
    "1 element isn't published, so it won't be on your website.",
  );
});

test("Show selects the element from another page, and in Content mode, without showing it (#1512)", async () => {
  await dontPublish("Heading");
  await page.getByRole("radio", { name: "Content", exact: true }).click();

  // From Publish, on another page: the page with it opens, and it's selected.
  await toolbar().getByRole("combobox", { name: "Page shown" }).selectOption("Page not found");
  await expect(canvas().locator("h1")).toHaveText("Sorry, this page doesn't exist");
  const publish = await openPublish();
  await publish.getByRole("button", { name: "Show", exact: true }).click();
  await expect(publish).toHaveCount(0);
  await expect(canvas().locator("h1[data-webforge-hidden]")).toBeVisible();
  await expect(editPanel().getByRole("heading", { name: "Heading", exact: true })).toBeVisible();
  // Content mode: the badge stays, without its Show, so the heading stays left out.
  const badge = canvas().locator(".wf-unpublished");
  await expect(badge).toHaveCount(1);
  await expect(badge.getByRole("button", { name: "Show", exact: true })).toHaveCount(0);

  // From Preview's message, with something else selected: Preview counts the page it opened.
  await row("Section").click();
  await expect(editPanel().getByRole("heading", { name: "Section", exact: true })).toBeVisible();
  const toast = await openPreview();
  await expect(toast).toContainText("1 element on this page isn't published");
  await toast.getByRole("button", { name: "Show", exact: true }).click();
  await expect(editPanel().getByRole("heading", { name: "Heading", exact: true })).toBeVisible();
  await expect(canvas().locator("h1[data-webforge-hidden]")).toHaveCount(1);
});
