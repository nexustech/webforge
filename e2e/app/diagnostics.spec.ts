import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { launchDesktopApp, removeWhenFree, type WebforgeApp, waitForCanvas } from "./launch.js";
import { chooseFromMenu } from "./menus.js";
import { stubFileDialogs } from "./sites.js";

// Help › Diagnostics… (5.41, BD-2): the usage summary in words, saved as one file with the newest
// crash reports, to attach to a report. Nothing is sent.

let dir: string;
let app: WebforgeApp | undefined;

test.beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "webforge-diagnostics-"));
});

test.afterEach(async () => {
  await app?.close();
  app = undefined;
  void removeWhenFree(dir);
});

test("shows the usage summary in words and saves it as one file, nothing of the site in it (BD-2)", async () => {
  const launched = await launchDesktopApp({ userDataDir: join(dir, "user-data") });
  app = launched;
  const page = await launched.firstWindow();
  await waitForCanvas(page);
  const saved = join(dir, "diagnostics.json");
  await stubFileDialogs(launched, saved);

  await chooseFromMenu(launched, page, "Help", "Diagnostics…");
  const window = page.getByRole("dialog", { name: "Diagnostics" });
  // The summary has loaded once the window shows the install number.
  await expect(window.getByText("Install number")).toBeVisible();
  await expect(window.getByText(/^Starting .*: /)).toBeVisible();

  await window.getByRole("button", { name: "Save Report…" }).click();
  await expect(window.getByText(/Report saved/)).toBeVisible();
  const text = readFileSync(saved, "utf8");
  const report = JSON.parse(text) as Record<string, unknown>;
  expect(Object.keys(report)).toEqual(["summary", "crashReports"]);
  // Nothing of where it's kept, nor of the site open.
  expect(text).not.toContain(dir);
  expect(text).not.toContain("Bakery");
});
