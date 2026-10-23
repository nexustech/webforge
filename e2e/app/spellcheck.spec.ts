import { type ElectronApplication, expect, type Page, test } from "@playwright/test";
import { launchDesktopApp } from "./launch.js";

// Spell check (1.22, F-ED-19): the system's checker underlines misspellings while editing, and a
// right-click offers suggestions and Add to Dictionary. Windows and macOS only: on Linux Electron
// would download dictionaries from Google, so spell check stays off there.

test.skip(process.platform === "linux", "spell check uses the system's checker (Windows, macOS)");

let app: ElectronApplication;
let page: Page;

test.beforeEach(async () => {
  app = await launchDesktopApp();
  page = await app.firstWindow();
  await expect(page.getByRole("region", { name: "Right panels" })).toBeVisible();
  // Record the context menu instead of showing a native one the test can't close.
  await app.evaluate(({ Menu }) => {
    const shown: string[][] = [];
    (globalThis as { shownMenus?: string[][] }).shownMenus = shown;
    Menu.prototype.popup = function popup() {
      shown.push(this.items.map((item) => (item.type === "separator" ? "—" : item.label)));
    };
  });
});

test.afterEach(async () => {
  await app.close();
});

const shownMenus = () =>
  app.evaluate(() => (globalThis as { shownMenus?: string[][] }).shownMenus ?? []);

test("offers spelling suggestions for a misspelt word in a text field", async () => {
  if (process.platform === "win32") {
    // Windows follows the site's language (English for a new site).
    const languages = await app.evaluate(({ session }) =>
      session.defaultSession.getSpellCheckerLanguages(),
    );
    expect(languages.some((language) => language.toLowerCase().startsWith("en"))).toBe(true);
  }

  await page
    .getByRole("region", { name: "Right panels" })
    .getByRole("tab", { name: "Site" })
    .click();
  await page.getByRole("button", { name: "Add Page" }).click();
  const field = page.getByRole("textbox", { name: "Page name" });
  await field.fill("");
  await field.pressSequentially("Our bakkery ", { delay: 20 });

  // The checker works in the background: right-click until it has looked at the word.
  await expect
    .poll(
      async () => {
        await field.click({ button: "right", position: { x: 50, y: 10 } });
        return (await shownMenus()).at(-1) ?? [];
      },
      { timeout: 15_000 },
    )
    .toContain("Add to Dictionary");
  const menu = (await shownMenus()).at(-1) ?? [];
  expect(menu).toContain("bakery");
  expect(menu.slice(-5)).toEqual(["Cut", "Copy", "Paste", "—", "Select All"]);
});

test("offers spelling suggestions inside rich text on the canvas (1.23)", async () => {
  const canvas = page.frameLocator(".editor__canvas iframe");
  const editor = canvas.locator(".site-text .ProseMirror");
  await canvas.getByText("Tell visitors what you do and why they will love it.").click();
  await editor.click();
  await expect(editor).toBeFocused();
  await page.keyboard.press("End");
  await page.keyboard.type(" Fresh bakkery ", { delay: 20 });
  // Electron's checker only looks at an editable that doesn't turn it off.
  await expect(editor).not.toHaveAttribute("spellcheck", "false");

  await expect
    .poll(
      async () => {
        // Right-click the misspelt word itself: its place on the page, from a range over it.
        const at = await editor.evaluate((element) => {
          const walker = element.ownerDocument.createTreeWalker(element, NodeFilter.SHOW_TEXT);
          for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
            const index = node.textContent?.indexOf("bakkery") ?? -1;
            if (index === -1) continue;
            const range = element.ownerDocument.createRange();
            range.setStart(node, index + 2);
            range.setEnd(node, index + 3);
            const box = range.getBoundingClientRect();
            const frame = element.ownerDocument.defaultView?.frameElement as HTMLElement | null;
            const place = frame?.getBoundingClientRect();
            // The canvas is zoomed (to fit a small screen, #287): its points are scaled.
            const scale =
              frame !== null && frame !== undefined && place !== undefined && frame.offsetWidth > 0
                ? place.width / frame.offsetWidth
                : 1;
            return {
              x: (place?.x ?? 0) + (box.x + box.width / 2) * scale,
              y: (place?.y ?? 0) + (box.y + box.height / 2) * scale,
            };
          }
          return null;
        });
        if (at === null) return [];
        await page.mouse.click(at.x, at.y, { button: "right" });
        return (await shownMenus()).at(-1) ?? [];
      },
      { timeout: 15_000 },
    )
    .toContain("Add to Dictionary");
  expect((await shownMenus()).at(-1) ?? []).toContain("bakery");
});
