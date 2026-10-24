import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type ElectronApplication, expect, type Page, test } from "@playwright/test";
import { createSite, type MediaId } from "@webforge/model";
import { ProjectStore } from "@webforge/storage";
import { heroPhoto } from "@webforge/test-utils";
import { placeCaret } from "./caret.js";
import { launchDesktopApp } from "./launch.js";

// Design | Content (M3, 1.10): switching is instant, locks the layout in Content mode and is
// remembered with the site. Simple | Advanced is a per-person preference.

let dir: string;
let sitePath: string;
let app: ElectronApplication | undefined;

test.beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "webforge-modes-"));
  sitePath = join(dir, "Modes.wforge");
  ProjectStore.create(sitePath, { name: "Modes" }).close();
});

test.afterEach(async () => {
  await app?.close();
  app = undefined;
  rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
});

/** Starts Webforge with the site, as a double-click on the file does, and waits for the canvas. */
async function openSite(): Promise<Page> {
  app = await launchDesktopApp({ args: [sitePath] });
  const page = await app.firstWindow();
  await expect(canvas(page).locator("style[data-webforge-site-css]")).toHaveCount(1, {
    timeout: 30_000,
  });
  return page;
}

const canvas = (page: Page) => page.frameLocator(".editor__canvas iframe");
const modeButton = (page: Page, name: "Design" | "Content") =>
  page.getByRole("radio", { name, exact: true });
/** A button of Puck's action bar on the selected element, drawn inside the canvas frame. */
const action = (page: Page, title: "Duplicate" | "Delete") =>
  canvas(page).locator(`[class*="ActionBarAction"][title="${title}"]`);

/** Selects the starter heading, so Puck shows its action bar for it. */
async function selectHeading(page: Page): Promise<void> {
  await canvas(page).locator("h1").click();
  await expect(action(page, "Duplicate")).toBeVisible();
}

test.describe("editor modes", () => {
  test("switches to Content mode without a reload, locking the layout, and remembers it", async () => {
    let page = await openSite();
    await expect(modeButton(page, "Design")).toHaveAttribute("data-state", "on");
    await selectHeading(page);
    await expect(action(page, "Delete")).toBeVisible();

    await modeButton(page, "Content").click();

    await expect(modeButton(page, "Content")).toHaveAttribute("data-state", "on");
    // Same page, no reload: the heading is still on the canvas; deleting and duplicating are off.
    await expect(canvas(page).locator("h1")).toBeVisible();
    await expect(action(page, "Delete")).toHaveCount(0);

    await app?.close();
    page = await openSite();

    await expect(modeButton(page, "Content")).toHaveAttribute("data-state", "on");
  });

  test("keeps text editable in Content mode and locks styles and layout, then unlocks (1.26)", async () => {
    const page = await openSite();
    const edit = page.getByRole("region", { name: "Right panels" });
    const tabs = () => edit.getByRole("tablist", { name: "Edit panel" }).getByRole("tab");
    await selectHeading(page);
    await expect(tabs()).toHaveText(["Content", "Style"]);

    await modeButton(page, "Content").click();
    // Styles are locked: the Edit panel keeps its Content tab only.
    await expect(tabs()).toHaveText(["Content"]);
    // Text stays editable.
    const text = edit.getByRole("textbox", { name: "Text" });
    await text.fill("Fresh bread daily");
    await text.blur();
    await expect(canvas(page).locator("h1")).toHaveText("Fresh bread daily");
    // Pasting text works too; only pasting elements is locked.
    await app?.evaluate(({ clipboard }) => clipboard.writeText("Cakes to order"));
    await text.focus();
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.press("ControlOrMeta+v");
    await text.blur();
    await expect(canvas(page).locator("h1")).toHaveText("Cakes to order");
    // The layout is locked: Delete and Duplicate do nothing, and the Add panel is gone.
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.keyboard.press("Delete");
    await page.keyboard.press("ControlOrMeta+d");
    await expect(canvas(page).locator("h1")).toHaveCount(1);
    await expect(
      page.getByRole("region", { name: "Left panels" }).getByRole("tab", { name: "Add" }),
    ).toHaveCount(0);

    await modeButton(page, "Design").click();
    await selectHeading(page);
    await expect(tabs()).toHaveText(["Content", "Style"]);
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.keyboard.press("ControlOrMeta+d");
    await expect(canvas(page).locator("h1")).toHaveCount(2);
  });

  test("edits text (typed and pasted), links, images and list items in Content mode (1.26)", async () => {
    // A site with a photo in Media, a Hero (title, image, button link) and an FAQ.
    sitePath = join(dir, "Content.wforge");
    const store = ProjectStore.create(sitePath, { name: "Content" });
    const { hash } = store.putAsset({
      mediaId: "shop",
      data: heroPhoto(),
      mime: "image/jpeg",
      width: 1600,
      height: 1000,
      originalName: "Shop front.jpg",
    });
    const site = createSite({
      name: "Content",
      language: "en-GB",
      homeTitle: "Home",
      notFoundTitle: "Page not found",
    });
    site.media = {
      ["shop" as MediaId]: {
        id: "shop" as MediaId,
        hash,
        name: "shop-front",
        fileName: "Shop front.jpg",
        kind: "image",
        mimeType: "image/jpeg",
        width: 1600,
        height: 1000,
        alt: "Our shop front",
      },
    };
    const home = site.pages[site.homePageId];
    if (home === undefined) throw new Error("no home page");
    home.doc.content = [
      { type: "Hero", props: { id: "hero", title: "Fresh bread", buttonLabel: "Visit us" } },
      { type: "Text", props: { id: "text", text: "<p>We bake every day.</p>" } },
      {
        type: "Faq",
        props: {
          id: "faq",
          title: "Questions",
          items: [
            {
              type: "FaqItem",
              props: { id: "q1", question: "Open on Sunday?", answer: "<p>No</p>" },
            },
          ],
        },
      },
    ];
    store.saveSite(site);
    store.close();
    const page = await openSite();
    const frame = canvas(page);
    const edit = page.getByRole("region", { name: "Right panels" });
    await modeButton(page, "Content").click();

    // Rich text on the canvas: typed, then pasted as plain text and as HTML (kept to the site's
    // formatting).
    const text = frame.locator(".site-text");
    await text.getByText("We bake every day.").click();
    await placeCaret(text.locator(".ProseMirror"), "end");
    await page.keyboard.type(" Fresh");
    await app?.evaluate(({ clipboard }) => clipboard.writeText(" every morning."));
    await page.keyboard.press("ControlOrMeta+v");
    await app?.evaluate(({ clipboard, ClipboardItem }) =>
      clipboard.write([
        new ClipboardItem({
          "text/html": new Blob(["<p> <b>Warm</b> loaves.</p>"], { type: "text/html" }),
          "text/plain": new Blob([" Warm loaves."], { type: "text/plain" }),
        }),
      ]),
    );
    await page.keyboard.press("ControlOrMeta+v");
    await expect(text).toContainText("We bake every day. Fresh every morning.");
    await expect(text).toContainText("Warm loaves.");
    await expect(text.locator("strong, b")).toHaveText("Warm");

    // Only dragging is off: no element on the canvas says it is disabled, and a click selects one.
    await expect(frame.locator("[data-puck-component]").first()).toBeVisible();
    await expect(frame.locator("[aria-disabled='true']")).toHaveCount(0);

    // An image swapped, and a link set, on the Hero.
    await frame.locator("h1").click();
    await page.getByRole("button", { name: "Image Choose an image…" }).click();
    await page.getByRole("option", { name: "Shop front.jpg" }).dblclick();
    await expect(frame.locator(".site-hero img")).toHaveAttribute("alt", "Our shop front");
    await edit.getByRole("button", { name: "Add Link…" }).click();
    const dialog = page.getByRole("dialog", { name: "Link" });
    await dialog.getByRole("radio", { name: "Web address" }).click();
    await dialog.getByRole("textbox", { name: "Web address" }).fill("book.example");
    await dialog.getByRole("button", { name: "Save Link" }).click();
    await expect(edit.getByText("https://book.example")).toBeVisible();

    // A list item added to the FAQ.
    await frame.locator(".site-faq h2").click();
    await edit.getByRole("button", { name: "Add Question" }).click();
    await expect(frame.locator(".site-faq-item")).toHaveCount(2);
  });

  test("turns Advanced mode on from the View menu", async () => {
    const page = await openSite();

    await page.getByRole("menuitem", { name: "View", exact: true }).click();
    await page.getByRole("menuitem", { name: "Use Advanced Mode" }).click();
    await expect(page.getByRole("menu")).toHaveCount(0);
    await page.getByRole("menuitem", { name: "View", exact: true }).click();

    await expect(page.getByRole("menuitem", { name: "Use Simple Mode" })).toBeVisible();
  });
});
