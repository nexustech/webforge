import { type ElectronApplication, expect, type Page, test } from "@playwright/test";
import { desktopVersion, launchDesktopApp } from "./launch.js";

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

test.afterAll(async () => {
  await app.close();
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

    expect(globals).toEqual({ require: "undefined", process: "undefined", webforgeKeys: ["app"] });
  });

  test("enforces a strict Content Security Policy", async () => {
    const csp = await page
      .locator('meta[http-equiv="Content-Security-Policy"]')
      .getAttribute("content");

    expect(csp).toContain("default-src 'none'");
    expect(csp).toContain("script-src 'self'");
    expect(csp).not.toContain("unsafe-inline");
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

  test("logs no errors in the renderer", () => {
    // The CSP test above triggers one expected violation report; ignore only that one.
    const unexpected = pageErrors.filter((text) => !text.includes("Content Security Policy"));
    expect(unexpected).toEqual([]);
  });
});
