import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { launchDesktopApp, removeWhenFree, type WebforgeApp, waitForCanvas } from "./launch.js";
import { chooseFromMenu } from "./menus.js";

// Help › Report a Problem (5.23, OL-10): the person's report opens in their browser for them to
// send; Webforge makes no request itself, and the message is kept until it's cleared.

let dir: string;
let app: WebforgeApp | undefined;

test.beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "webforge-report-"));
});

test.afterEach(async () => {
  await app?.close();
  app = undefined;
  void removeWhenFree(dir);
});

/** The editor's window with its site, the browser stood in for, and its requests counted. */
async function opened(userDataDir: string) {
  const launched = await launchDesktopApp({ userDataDir });
  app = launched;
  const page = await launched.firstWindow();
  await waitForCanvas(page);
  await launched.evaluate(({ shell }) => {
    const urls: string[] = [];
    Object.assign(globalThis, { urls });
    Object.assign(shell, {
      openExternal: async (url: string) => {
        urls.push(url);
      },
    });
  });
  return { launched, page };
}

const dialog = (page: Page) => page.getByRole("dialog", { name: "Report a Problem" });

test("opens a report in the browser, filled in, and keeps the message until it's cleared (OL-10)", async () => {
  const userDataDir = join(dir, "user-data");
  const first = await opened(userDataDir);
  const { page } = first;
  // Every request the window makes from here: the dialog must make none.
  const requests: string[] = [];
  page.on("request", (request) => {
    if (/^https?:/.test(request.url())) requests.push(request.url());
  });

  await chooseFromMenu(first.launched, page, "Help", "Report a Problem…");
  const report = dialog(page);
  await expect(report.getByText(/^Sent with it: /)).toBeVisible();
  await report.getByRole("textbox", { name: "What happened?" }).fill("The menu froze");
  await report.getByRole("button", { name: "Open a GitHub Issue" }).click();
  await expect(report.getByText(/The form opened in your browser/)).toBeVisible();

  const urls = await first.launched.evaluate(() => (globalThis as { urls?: string[] }).urls ?? []);
  expect(urls).toHaveLength(1);
  const address = new URL(urls[0] ?? "");
  expect(`${address.origin}${address.pathname}`).toBe(
    "https://github.com/nexustech/webforge/issues/new",
  );
  expect(address.searchParams.get("happened")).toMatch(/^The menu froze\n\n/);
  expect(requests).toEqual([]);

  // Closed and opened again: the message is still there, until it's cleared.
  await page.keyboard.press("Escape");
  await expect(report).toBeHidden();
  await first.launched.close();
  app = undefined;
  const second = await opened(userDataDir);
  await chooseFromMenu(second.launched, second.page, "Help", "Report a Problem…");
  const again = dialog(second.page);
  await expect(again.getByRole("textbox", { name: "What happened?" })).toHaveValue(
    "The menu froze",
  );
  await again.getByRole("button", { name: "Clear Message" }).click();
  await expect(again.getByRole("textbox", { name: "What happened?" })).toHaveValue("");
});

test("takes a screenshot of the window only when asked, and shows it first (OL-10)", async () => {
  const { launched, page } = await opened(join(dir, "user-data"));
  await chooseFromMenu(launched, page, "Help", "Report a Problem…");
  const report = dialog(page);
  await expect(report.getByRole("img")).toHaveCount(0);
  await report.getByRole("button", { name: "Take a Screenshot of This Window" }).click();
  const shown = report.getByRole("img", { name: /screenshot of the/i });
  await expect(shown).toBeVisible();
  expect(await shown.getAttribute("src")).toMatch(/^data:image\/jpeg;base64,/);
});
