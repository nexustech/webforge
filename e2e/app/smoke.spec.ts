import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type ElectronApplication, expect, type Page, test } from "@playwright/test";
import { changedDocuments, createSite } from "@webforge/model";
import { desktopDir, desktopVersion, launchDesktopApp } from "./launch.js";
import { type RendererWindow, stubFileDialogs } from "./sites.js";

// Smoke test of the desktop shell: it starts, shows its window and keeps the renderer locked down.
// It also covers the process entry points that unit coverage excludes (main, preload, renderer).

let app: ElectronApplication;
let page: Page;
const pageErrors: string[] = [];

test.beforeAll(async () => {
  app = await launchDesktopApp();
  page = await app.firstWindow();
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") {
      pageErrors.push(message.text());
    }
  });
  await page.waitForLoadState("domcontentloaded");
});

const siteDir = mkdtempSync(join(tmpdir(), "webforge-e2e-"));

test.afterAll(async () => {
  await app.close();
  // The app holds the open site until it quits.
  rmSync(siteDir, { recursive: true, force: true });
});

test.describe("desktop shell", () => {
  test("opens a window showing Webforge and the version from the main process", async () => {
    await expect(page).toHaveTitle("Webforge");
    await expect(page.getByRole("heading", { level: 1, name: "Webforge" })).toBeVisible();
    // The version travels main → IPC → preload → renderer, so this proves the whole round trip.
    await expect(page.getByText(`Version ${desktopVersion}`)).toBeVisible();
  });

  test("loads the production renderer from disk", () => {
    expect(page.url()).toMatch(/^file:\/\/.*\/out\/renderer\/index\.html$/);
  });

  test("runs the renderer in an OS-level sandbox", async () => {
    test.skip(
      process.platform === "linux",
      "Electron reports OS sandboxing on Windows and macOS only",
    );

    const renderers = await app.evaluate(({ app: electronApp }) =>
      electronApp
        .getAppMetrics()
        .filter((metric) => metric.type === "Tab")
        .map((metric) => metric.sandboxed),
    );

    expect(renderers.length).toBeGreaterThan(0);
    expect(renderers.every((sandboxed) => sandboxed === true)).toBe(true);
  });

  test("gives the renderer no Node or Electron access, only window.webforge", async () => {
    const globals = await page.evaluate(() => ({
      require: typeof (globalThis as { require?: unknown }).require,
      process: typeof (globalThis as { process?: unknown }).process,
      webforgeKeys: Object.keys((globalThis as { webforge?: object }).webforge ?? {}),
    }));

    expect(globals).toEqual({
      require: "undefined",
      process: "undefined",
      webforgeKeys: ["app", "project", "site"],
    });
  });

  test("ships without the performance-test hooks", async () => {
    // Only `electron-vite build --mode perf` includes them (e2e/perf, ADR 0007).
    const perfHooks = await page.evaluate(
      () => typeof (globalThis as { __webforgePerf?: unknown }).__webforgePerf,
    );
    const rendererFiles = readdirSync(join(desktopDir, "out/renderer/assets"))
      .filter((file) => file.endsWith(".js"))
      .map((file) => readFileSync(join(desktopDir, "out/renderer/assets", file), "utf8"));

    expect(perfHooks).toBe("undefined");
    expect(rendererFiles.filter((code) => code.includes("__webforgePerf"))).toEqual([]);
  });

  test("enforces a strict Content Security Policy", async () => {
    const csp = await page
      .locator('meta[http-equiv="Content-Security-Policy"]')
      .getAttribute("content");

    expect(csp).toContain("default-src 'none'");
    expect(csp).toContain("script-src 'self'");
    // Inline styles are allowed for the canvas engine (ADR 0004); inline scripts never are.
    expect(csp).not.toMatch(/script-src[^;]*unsafe-inline/);
    expect(csp).not.toContain("unsafe-eval");
    expect(csp).not.toContain("nonce-");

    const inlineScriptRan = await page.evaluate(() => {
      const script = document.createElement("script");
      script.textContent = "window.__inlineScriptRan = true";
      document.body.append(script);
      return (globalThis as { __inlineScriptRan?: boolean }).__inlineScriptRan === true;
    });
    expect(inlineScriptRan).toBe(false);
  });

  test("denies pop-up windows", async () => {
    const opened = await page.evaluate(() => window.open("https://example.com/") !== null);

    expect(opened).toBe(false);
    expect(app.windows()).toHaveLength(1);
  });

  test("blocks navigation away from the app", async () => {
    const appUrl = page.url();
    const navigated = page
      .waitForEvent("framenavigated", { timeout: 2_000 })
      .then(() => true)
      .catch(() => false);

    await page.evaluate(() => {
      window.location.href = "https://example.com/";
    });

    expect(await navigated).toBe(false);
    expect(page.url()).toBe(appUrl);
  });

  test("creates and reopens a site through the main process (better-sqlite3 in Electron)", async () => {
    const path = join(siteDir, "Rosa's Bakery.wforge");
    await stubFileDialogs(app, path);
    const project = {
      name: "Rosa's Bakery",
      fileName: "Rosa's Bakery.wforge",
      formatVersion: 1,
      syncService: null,
    };

    const created = await page.evaluate(() =>
      (window as unknown as RendererWindow).webforge.project.create(),
    );
    expect(created).toEqual({ status: "opened", project });
    expect(readFileSync(path).subarray(0, 16).toString("latin1")).toBe("SQLite format 3\0");

    const opened = await page.evaluate(() =>
      (window as unknown as RendererWindow).webforge.project.open(),
    );
    expect(opened).toEqual({ status: "opened", project });
    const current = await page.evaluate(() =>
      (window as unknown as RendererWindow).webforge.project.getCurrent(),
    );
    expect(current).toEqual(project);
  });

  test("refuses to open a file that is not a site and keeps the current one", async () => {
    const path = join(siteDir, "notes.wforge");
    writeFileSync(path, "Just some text, not a Webforge site.");
    await stubFileDialogs(app, path);

    const opened = await page.evaluate(() =>
      (window as unknown as RendererWindow).webforge.project.open(),
    );
    expect(opened).toEqual({ status: "failed", reason: "not-a-project" });
    const current = await page.evaluate(() =>
      (window as unknown as RendererWindow).webforge.project.getCurrent(),
    );
    expect(current?.fileName).toBe("Rosa's Bakery.wforge");
  });

  test("saves the site's documents over IPC and reads them back after reopening", async () => {
    const path = join(siteDir, "Documents.wforge");
    await stubFileDialogs(app, path);
    const site = createSite({
      name: "Documents",
      language: "en",
      homeTitle: "Home",
      notFoundTitle: "Page not found",
    });

    const result = await page.evaluate(
      async ({ changes }) => {
        const { project } = (window as unknown as RendererWindow).webforge;
        await project.create();
        const empty = await project.readSite();
        const saved = await project.commit(changes);
        await project.open();
        return { empty, saved, read: await project.readSite() };
      },
      { changes: changedDocuments(undefined, site) },
    );

    expect(result).toEqual({
      empty: { status: "empty" },
      saved: { status: "saved" },
      read: { status: "ok", site },
    });
  });

  test("logs no errors in the renderer", () => {
    // The CSP test above triggers one expected violation report; ignore only that one.
    const unexpected = pageErrors.filter((text) => !text.includes("Content Security Policy"));
    expect(unexpected).toEqual([]);
  });
});
