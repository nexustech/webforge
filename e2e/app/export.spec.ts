import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type ElectronApplication, expect, type Page, test } from "@playwright/test";
import { createSite, newId, type PageId } from "@webforge/model";
import { ProjectStore } from "@webforge/storage";
import { launchDesktopApp, waitForCanvas } from "./launch.js";
import { exportFromEditor, stubFileDialogs } from "./sites.js";

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
    // The pages and their files and robots.txt; no llms.txt or Markdown copies, which a new site
    // leaves off (3.15, SEO-12).
    await expect(report).toContainText(/Pages: \d+ · Files: 9 · Size: \d+/);
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
    expect(existsSync(join(folder, "llms.txt"))).toBe(false);
    expect(existsSync(join(folder, "index.md"))).toBe(false);
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

test.describe("Export site with Site Check (3.6, X5)", () => {
  test("stops for a Must fix and writes nothing; once fixed, exports with a Should fix still open", async () => {
    // A site whose About page is called "con", a name Windows keeps for a device (Must fix), and
    // with a page without a title (Should fix, which only publishing must have fixed).
    const dir = mkdtempSync(join(parent, "checked-"));
    const site = createSite({
      name: "Rosa's Bakery",
      language: "en",
      homeTitle: "Home",
      notFoundTitle: "Page not found",
    });
    const home = site.pages[site.homePageId];
    if (home === undefined) throw new Error("no home page");
    const page = (slug: string, title: string) => {
      const id = newId("page") as PageId;
      site.pages[id] = { ...structuredClone(home), id, slug, title };
      site.pageOrder.splice(1, 0, id);
    };
    page("con", "About us");
    page("menu", "");
    const sitePath = join(dir, "Rosa's Bakery.wforge");
    const store = ProjectStore.create(sitePath, { name: "Rosa's Bakery" });
    store.saveSite(site);
    store.close();
    const checked = await launchDesktopApp({
      userDataDir: join(dir, "user-data"),
      args: [sitePath],
    });
    try {
      const editor = await checked.firstWindow();
      await waitForCanvas(editor);
      const folder = join(dir, "exported");
      await stubFileDialogs(checked, folder);
      const rule = (id: string) =>
        editor.getByRole("region", { name: "Bottom panel" }).locator(`[data-rule="${id}"]`);

      // Stopped before anything is asked or written, with Site Check shown at what to fix.
      await editor.getByRole("button", { name: "Export Site…", exact: true }).click();
      await expect(editor.getByText("Fix 1 thing in Site Check before exporting")).toBeVisible();
      await expect(rule("deviceNames")).toHaveAttribute("data-status", "fail");
      await expect(editor.getByRole("dialog", { name: "Export Site" })).toBeHidden();
      expect(existsSync(folder)).toBe(false);

      // Fixed: the page renamed. The page without a title is still to look at.
      await rule("deviceNames").getByRole("button", { name: "Fix" }).click();
      await expect(rule("deviceNames")).toHaveAttribute("data-status", "pass");
      await expect(rule("pageTitles")).toHaveAttribute("data-status", "warn");

      // Now it exports, every page written, the one without a title too.
      await exportFromEditor(editor);
      expect(existsSync(join(folder, "index.html"))).toBe(true);
      expect(readdirSync(folder).filter((name) => name.endsWith(".html")).length).toBe(4);
      expect(readdirSync(folder)).not.toContain("con.html");
    } finally {
      await checked.close();
    }
  });
});
