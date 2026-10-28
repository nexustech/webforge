import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type ElectronApplication, expect, type Page, test } from "@playwright/test";
import { launchDesktopApp } from "./launch.js";
import { stubFileDialogs } from "./sites.js";

// Export from the editor (3.3): the web address prompt, the export dialog, the site built in the
// export utility process and written to the folder or ZIP chosen in the (stubbed) dialog, and the
// report, whose Open Site button opens the export from disk (stubbed, so no browser opens).

let app: ElectronApplication;
let page: Page;
const parent = mkdtempSync(join(tmpdir(), "webforge-e2e-export-"));

test.beforeAll(async () => {
  app = await launchDesktopApp();
  page = await app.firstWindow();
  await page.waitForLoadState("domcontentloaded");
  // What Open Site and Show ZIP File would open, instead of opening it.
  await app.evaluate(({ shell }) => {
    const opened: string[] = [];
    Object.assign(globalThis, { opened });
    Object.assign(shell, {
      openPath: async (path: string) => {
        opened.push(`open ${path}`);
        return "";
      },
      showItemInFolder: (path: string) => {
        opened.push(`show ${path}`);
      },
    });
  });
});

test.afterAll(async () => {
  await app.close();
  rmSync(parent, { recursive: true, force: true });
});

/** What Open Site and Show ZIP File asked the system to open. */
const opened = () =>
  app.evaluate(() => (globalThis as unknown as { opened: string[] }).opened.slice());

/** File → Export Site…, past the web address prompt while the site has none (X3). */
async function startExport(webAddress: "skip" | "skip-always" | "not-asked") {
  await page.getByRole("button", { name: "Export Site…", exact: true }).click();
  if (webAddress === "not-asked") return;
  const prompt = page.getByRole("alertdialog", { name: "Add your site's web address?" });
  await expect(prompt).toBeVisible();
  if (webAddress === "skip-always") {
    await prompt.getByRole("checkbox", { name: "Don't ask again for this site" }).check();
  }
  await prompt.getByRole("button", { name: "Export without it" }).click();
}

test.describe("Export site", () => {
  test("builds the open site into a self-contained folder, and reports it", async () => {
    const folder = join(parent, "my-site");
    await stubFileDialogs(app, folder);

    await startExport("skip");
    const options = page.getByRole("dialog", { name: "Export Site" });
    await expect(options.getByRole("radio", { name: "A folder" })).toBeChecked();
    await options.getByRole("button", { name: "Export…" }).click();

    const report = page.getByRole("dialog", { name: "Site exported" });
    await expect(report).toBeVisible({ timeout: 30_000 });
    await expect(report).toContainText("Saved in the folder “my-site”.");
    // The pages and their files, robots.txt, and llms.txt with the home page's Markdown copy (3.5).
    await expect(report).toContainText(/Pages: \d+ · Files: 11 · Size: \d+/);
    await expect(report).toContainText("Your site has no web address");
    // The progress toast is gone, with its Cancel button (3.1).
    await expect(
      page.locator("[data-sonner-toast]").getByRole("button", { name: "Cancel" }),
    ).toHaveCount(0);
    await report.getByRole("button", { name: "Open Site" }).click();
    await expect.poll(opened).toEqual([`open ${join(folder, "index.html")}`]);
    await report.getByRole("button", { name: "Done" }).click();
    await expect(report).toBeHidden();

    const index = readFileSync(join(folder, "index.html"), "utf8");
    expect(index).toContain("<!doctype html>");
    expect(index).toContain("Welcome to our business");
    expect(index).toMatch(/<script defer src="assets\/js\/webforge\.[0-9a-f]{10}\.js">/);
    expect(readFileSync(join(folder, "404.html"), "utf8")).toContain("<title>Page not found");
    expect(readFileSync(join(folder, "llms.txt"), "utf8")).toContain("](/index.md)");
    expect(existsSync(join(folder, "robots.txt"))).toBe(true);
    expect(readdirSync(join(folder, "assets")).sort()).toEqual(["css", "fonts", "js"]);
    expect(existsSync(join(folder, ".webforge-export"))).toBe(true);
  });

  test("refuses a folder with other files and changes nothing", async () => {
    const folder = mkdtempSync(join(parent, "documents-"));
    writeFileSync(join(folder, "notes.txt"), "mine");
    await stubFileDialogs(app, folder);

    await startExport("skip");
    await page
      .getByRole("dialog", { name: "Export Site" })
      .getByRole("button", { name: "Export…" })
      .click();

    await expect(
      page.getByText("That folder already contains other files. Choose an empty folder"),
    ).toBeVisible({ timeout: 30_000 });
    expect(readdirSync(folder)).toEqual(["notes.txt"]);
  });

  test("saves a minified ZIP, and remembers the choices for the next export", async () => {
    const zip = join(parent, "my-site.zip");
    await stubFileDialogs(app, zip);

    await startExport("skip-always");
    const options = page.getByRole("dialog", { name: "Export Site" });
    await options.getByRole("radio", { name: "A ZIP file" }).check();
    await options.getByRole("checkbox", { name: "Make the files smaller" }).check();
    await options.getByRole("button", { name: "Export…" }).click();

    const report = page.getByRole("dialog", { name: "Site exported" });
    await expect(report).toContainText("Saved as “my-site.zip”.", { timeout: 30_000 });
    // A ZIP: its local file header's signature.
    expect(readFileSync(zip).subarray(0, 4)).toEqual(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
    await report.getByRole("button", { name: "Show ZIP File" }).click();
    await expect.poll(async () => (await opened()).at(-1)).toBe(`show ${zip}`);
    // Moved or deleted since: it says so, rather than showing nothing.
    rmSync(zip);
    await report.getByRole("button", { name: "Show ZIP File" }).click();
    await expect(page.getByText("The exported site isn't there any more")).toBeVisible();
    await report.getByRole("button", { name: "Done" }).click();

    // Not asked again for the web address, and the dialog starts from the last choices.
    await startExport("not-asked");
    const again = page.getByRole("dialog", { name: "Export Site" });
    await expect(again.getByRole("radio", { name: "A ZIP file" })).toBeChecked();
    await expect(again.getByRole("checkbox", { name: "Make the files smaller" })).toBeChecked();
    await again.getByRole("button", { name: "Cancel" }).click();
    await expect(again).toBeHidden();
  });
});
