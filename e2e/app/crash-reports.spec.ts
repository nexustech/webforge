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

  await app.evaluate(({ BrowserWindow }) => {
    BrowserWindow.getAllWindows()[0]?.webContents.forcefullyCrashRenderer();
  });

  const reportsDir = join(userData, "crash-reports");
  const reports = () =>
    existsSync(reportsDir) ? readdirSync(reportsDir).filter((name) => name.endsWith(".json")) : [];
  await expect.poll(reports).toHaveLength(1);
  const [name] = reports();
  expect(name).toMatch(/^crash-\d{8}-\d{6}-renderer\.json$/);
  const text = readFileSync(join(reportsDir, name ?? ""), "utf8");
  expect(JSON.parse(text)).toMatchObject({ process: "renderer", kind: "crashed" });
  expect(text).not.toContain("4711");
  expect(text).not.toContain("Secret");
  expect(text).not.toContain(dir);
});
