import { existsSync, mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { createSite } from "@webforge/model";
import { ProjectStore } from "@webforge/storage";
import { launchDesktopApp, type WebforgeApp } from "./launch.js";

// Local crash reports (F-SITE-7): a crash or uncaught error leaves a JSON report in the user-data
// folder, with no site content or paths, and nothing is sent anywhere.

const SECRET = "Secret Bakery 4711";

let dir: string;
let userData: string;
let app: WebforgeApp | undefined;

test.beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "webforge-crash-"));
  userData = join(dir, "user-data");
});

test.afterEach(async () => {
  await app?.close().catch(() => undefined);
  app = undefined;
  await rm(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
});

/** Starts Webforge with a site whose name and text are {@link SECRET}. */
async function openSecretSite(): Promise<WebforgeApp> {
  const sitePath = join(dir, `${SECRET}.wforge`);
  const store = ProjectStore.create(sitePath, { name: SECRET });
  store.saveSite(
    createSite({ name: SECRET, language: "en", homeTitle: SECRET, notFoundTitle: "Not found" }),
  );
  store.close();
  const launched = await launchDesktopApp({ userDataDir: userData, args: [sitePath] });
  await expect((await launched.firstWindow()).getByRole("banner")).toBeVisible();
  return launched;
}

/** Whether `text` is a whole report: JSON that parses (a file can be read while being written). */
function parses(text: string): boolean {
  try {
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
}

/** The single report that appears, checked to hold none of the site's text or paths. */
async function onlyReport(): Promise<{ name: string; report: Record<string, unknown> }> {
  const reportsDir = join(userData, "crash-reports");
  const reports = () =>
    existsSync(reportsDir) ? readdirSync(reportsDir).filter((name) => name.endsWith(".json")) : [];
  await expect.poll(reports, { timeout: 20_000 }).toHaveLength(1);
  const [name = ""] = reports();
  // The finished report, not just its file.
  const read = () => readFileSync(join(reportsDir, name), "utf8");
  await expect.poll(() => parses(read()), { timeout: 20_000 }).toBe(true);
  const text = read();
  expect(text).not.toContain("4711");
  expect(text).not.toContain("Secret");
  expect(text).not.toContain(dir);
  return { name, report: JSON.parse(text) };
}

test("an unhandled error in the main process leaves a report without its message", async () => {
  app = await openSecretSite();

  // A rejection whose message quotes the site, as a bug handling its content could.
  await app.evaluate((_electron, text) => {
    void Promise.reject(new Error(`Could not save "${text}"`));
  }, SECRET);

  const { name, report } = await onlyReport();
  expect(name).toMatch(/^crash-\d{8}-\d{6}-main\.json$/);
  expect(report).toMatchObject({
    process: "main",
    kind: "unhandled-rejection",
    error: { name: "Error" },
  });
});

test("a renderer crash leaves a local report", async () => {
  test.skip(
    process.platform === "linux",
    "Webforge ships for Windows and macOS; on Linux CI the forced renderer crash hangs and Electron never reports it",
  );
  app = await openSecretSite();

  await app.evaluate(({ BrowserWindow }) => {
    BrowserWindow.getAllWindows()[0]?.webContents.forcefullyCrashRenderer();
  });

  const { name, report } = await onlyReport();
  expect(name).toMatch(/^crash-\d{8}-\d{6}-renderer\.json$/);
  // The reason Electron gives: macOS reports a forced crash as the process being killed (#287).
  expect(report).toMatchObject({
    process: "renderer",
    kind: process.platform === "darwin" ? "killed" : "crashed",
  });

  // The crashed window has nothing to save or capture, so it closes at once (#121).
  const started = Date.now();
  await app.close();
  app = undefined;
  expect(Date.now() - started).toBeLessThan(5_000);
});
