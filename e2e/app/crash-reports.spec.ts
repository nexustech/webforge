import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type ElectronApplication, expect, test } from "@playwright/test";
import { createSite } from "@webforge/model";
import { ProjectStore } from "@webforge/storage";
import { launchDesktopApp } from "./launch.js";

// Local crash reports (F-SITE-7): a crash leaves a JSON report in the user-data folder, with no
// site content or paths, and nothing is sent anywhere.

const SECRET = "Secret Bakery 4711";

let dir: string;
let app: ElectronApplication | undefined;

test.beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "webforge-crash-"));
});

test.afterEach(async () => {
  await app?.close().catch(() => undefined);
  app = undefined;
  rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
});

test("a renderer crash leaves a local report without site content or paths", async () => {
  const userData = join(dir, "user-data");
  const sitePath = join(dir, `${SECRET}.wforge`);
  const store = ProjectStore.create(sitePath, { name: SECRET });
  store.saveSite(
    createSite({ name: SECRET, language: "en", homeTitle: SECRET, notFoundTitle: "Not found" }),
  );
  store.close();
  app = await launchDesktopApp({ userDataDir: userData, args: [sitePath] });
  const page = await app.firstWindow();
  await expect(page.getByRole("banner")).toBeVisible();

  // What Electron reports, so a failure says whether the event came at all.
  await app.evaluate(({ app: electronApp }) => {
    const gone: unknown[] = [];
    Object.assign(globalThis, { renderersGone: gone });
    electronApp.on("render-process-gone", (_event, _contents, details) => gone.push(details));
  });
  const mainLog: string[] = [];
  app.process().stderr?.on("data", (chunk: Buffer) => mainLog.push(chunk.toString()));
  await app.evaluate(({ BrowserWindow }) => {
    BrowserWindow.getAllWindows()[0]?.webContents.forcefullyCrashRenderer();
  });

  const reportsDir = join(userData, "crash-reports");
  const reports = () =>
    existsSync(reportsDir) ? readdirSync(reportsDir).filter((name) => name.endsWith(".json")) : [];
  try {
    await expect.poll(reports, { timeout: 20_000 }).toHaveLength(1);
  } catch (error) {
    const gone = await app
      .evaluate(() => (globalThis as unknown as { renderersGone: unknown[] }).renderersGone)
      .catch(() => "unknown");
    throw new Error(
      `No crash report. render-process-gone: ${JSON.stringify(gone)}; main log: ${mainLog.join("")}`,
      { cause: error },
    );
  }
  const [name] = reports();
  expect(name).toMatch(/^crash-\d{8}-\d{6}-renderer\.json$/);
  const text = readFileSync(join(reportsDir, name ?? ""), "utf8");
  // "crashed" on Windows and macOS; Linux may report the renderer as killed by its signal.
  expect(JSON.parse(text)).toMatchObject({ process: "renderer" });
  expect(text).not.toContain("4711");
  expect(text).not.toContain("Secret");
  expect(text).not.toContain(dir);
});
