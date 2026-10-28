import { type ElectronApplication, expect, type Page, test } from "@playwright/test";
import { BACKGROUND_WAIT } from "./budget.js";
import { placeCaret } from "./caret.js";
import { launchDesktopApp } from "./launch.js";

// Spell check (1.22, F-ED-19): the system's checker underlines misspellings while editing, and a
// right-click offers suggestions and Add to Dictionary. Windows and macOS only: on Linux Electron
// would download dictionaries from Google, so spell check stays off there.

test.skip(process.platform === "linux", "spell check uses the system's checker (Windows, macOS)");

let app: ElectronApplication;
let page: Page;
/** Whether this computer's spell checker checks English at all; asked once (see below). */
let checksEnglish: boolean | undefined;

/**
 * Whether the system's spell checker flags a misspelt English word. A computer without an English
 * dictionary flags nothing: GitHub's Windows Server runners have none, and Windows spell check is the
 * system's. Asked in a see-through window with a session of its own, so none of Webforge's settings
 * play a part: where the system can check, a Webforge spell check that broke still fails these tests.
 */
async function systemChecksEnglish(electronApp: ElectronApplication): Promise<boolean> {
  return electronApp.evaluate(async ({ BrowserWindow, session }) => {
    const partition = "spellcheck-probe";
    if (process.platform === "win32") {
      session.fromPartition(partition).setSpellCheckerLanguages(["en-US"]);
    }
    // Shown but see-through: a hidden window's text isn't checked.
    const probe = new BrowserWindow({
      width: 400,
      height: 120,
      opacity: 0,
      skipTaskbar: true,
      webPreferences: { partition, spellcheck: true },
    });
    try {
      await probe.loadURL("about:blank");
      await probe.webContents.executeJavaScript(`
        const field = document.createElement("textarea");
        field.style.cssText = "position: fixed; inset: 0; font: 16px sans-serif";
        document.body.append(field);
        field.focus();
      `);
      // Typed, not set: the checker looks at what's typed.
      probe.webContents.insertText("Our bakkery ");
      // The checker works in the background. A right-click puts the caret in the word, and a word
      // being typed in isn't flagged, so let it look first; then right-click until it has.
      for (let attempt = 0; attempt < 20; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        const word = await new Promise<string>((resolve) => {
          const onMenu = (_event: unknown, params: { misspelledWord: string }) => {
            clearTimeout(timer);
            resolve(params.misspelledWord);
          };
          const timer = setTimeout(() => {
            probe.webContents.off("context-menu", onMenu);
            resolve("");
          }, 500);
          probe.webContents.once("context-menu", onMenu);
          for (const type of ["mouseDown", "mouseUp"] as const) {
            probe.webContents.sendInputEvent({
              type,
              x: 60,
              y: 10,
              button: "right",
              clickCount: 1,
            });
          }
        });
        if (word !== "") return true;
      }
      return false;
    } finally {
      probe.destroy();
    }
  });
}

test.beforeEach(async () => {
  app = await launchDesktopApp();
  page = await app.firstWindow();
  checksEnglish ??= await systemChecksEnglish(app);
  test.skip(
    !checksEnglish,
    "this computer's spell checker has no English dictionary (GitHub's Windows runners)",
  );
  // The window starts slowly on a busy machine, after the probe's own window.
  await expect(page.getByRole("region", { name: "Right panels" })).toBeVisible({
    timeout: BACKGROUND_WAIT,
  });
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
  // The system's checker takes its time on a busy machine (#446): room for its wait.
  test.slow();
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
  await page.getByRole("menuitem", { name: "Blank Page…" }).click();
  const field = page.getByRole("textbox", { name: "Page name" });
  await field.fill("");
  await field.pressSequentially("Our bakkery ", { delay: 20 });

  // The checker works in the background: right-click until it has looked at the word. A check
  // the busy system drops isn't asked for again until the text changes, as when someone types on:
  // after the first look, each try types a space at the end and takes it away again (#563).
  let tries = 0;
  await expect
    .poll(
      async () => {
        if (tries++ > 0) {
          await field.press("End");
          await field.press("Space");
          await field.press("Backspace");
        }
        await field.click({ button: "right", position: { x: 50, y: 10 } });
        return (await shownMenus()).at(-1) ?? [];
      },
      { timeout: BACKGROUND_WAIT },
    )
    .toContain("Add to Dictionary");
  const menu = (await shownMenus()).at(-1) ?? [];
  expect(menu).toContain("bakery");
  expect(menu.slice(-5)).toEqual(["Cut", "Copy", "Paste", "—", "Select All"]);
});

test("offers spelling suggestions inside rich text on the canvas (1.23)", async () => {
  // The system's checker takes its time on a busy machine (#446): room for its wait.
  test.slow();
  const canvas = page.frameLocator(".editor__canvas iframe");
  const editor = canvas.locator(".site-text .ProseMirror");
  await canvas.getByText("Tell visitors what you do and why they will love it.").click();
  await editor.click();
  await expect(editor).toBeFocused();
  await placeCaret(editor, "end");
  await page.keyboard.type(" Fresh bakkery ", { delay: 20 });
  // Electron's checker only looks at an editable that doesn't turn it off.
  await expect(editor).not.toHaveAttribute("spellcheck", "false");

  let tries = 0;
  await expect
    .poll(
      async () => {
        // As in a text field: after the first look, the text changes so a dropped check is asked
        // for again (#563).
        if (tries++ > 0) {
          await placeCaret(editor, "end");
          await page.keyboard.press("Space");
          await page.keyboard.press("Backspace");
        }
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
      { timeout: BACKGROUND_WAIT },
    )
    .toContain("Add to Dictionary");
  expect((await shownMenus()).at(-1) ?? []).toContain("bakery");
});
