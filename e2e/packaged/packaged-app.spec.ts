import { type ChildProcess, spawn } from "node:child_process";
import { once } from "node:events";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type Browser, chromium, expect, type Page, test } from "@playwright/test";
import { ProjectStore } from "@webforge/storage";
import { desktopVersion } from "../app/launch.js";

// Checks the packaged app (`pnpm e2e:packaged`): electron-builder output with asar, Fuses and the
// unpacked better-sqlite3 binary. Fuses switch off --inspect, so Playwright's Electron launcher
// can't attach; the test starts the executable itself and connects over the Chrome DevTools
// Protocol, which reaches the renderer only.

const releaseDir = join(import.meta.dirname, "../../apps/desktop/release", desktopVersion);

/** The packaged executable that `electron-builder --dir` writes for this platform. */
function packagedExecutable(): string | undefined {
  switch (process.platform) {
    case "win32":
      return join(releaseDir, "win-unpacked", "Webforge.exe");
    case "darwin":
      return join(
        releaseDir,
        `mac-${process.arch}`,
        "Webforge.app",
        "Contents",
        "MacOS",
        "Webforge",
      );
    default:
      // Linux is not a release target.
      return undefined;
  }
}

/** Resolves with the DevTools WebSocket URL Chromium prints to stderr on start-up. */
async function devToolsUrl(child: ChildProcess): Promise<string> {
  const stderr = child.stderr;
  if (stderr === null) {
    throw new Error("The app was started without a stderr pipe");
  }
  let output = "";
  stderr.setEncoding("utf8");
  for await (const chunk of stderr) {
    output += String(chunk);
    const match = /DevTools listening on (ws:\/\/\S+)/.exec(output);
    if (match?.[1] !== undefined) {
      return match[1];
    }
  }
  throw new Error(`The app exited before DevTools started:\n${output}`);
}

async function appPage(browser: Browser): Promise<Page> {
  await expect.poll(() => browser.contexts().flatMap((context) => context.pages()).length).toBe(1);
  const [page] = browser.contexts().flatMap((context) => context.pages());
  if (page === undefined) {
    throw new Error("The app has no window");
  }
  await page.waitForFunction(() => "webforge" in window);
  return page;
}

const executable = packagedExecutable();
let siteDir: string;
let child: ChildProcess | undefined;
let browser: Browser | undefined;

test.beforeAll(() => {
  siteDir = mkdtempSync(join(tmpdir(), "webforge-packaged-"));
});

test.afterAll(async () => {
  await browser?.close();
  if (child !== undefined && child.exitCode === null) {
    const exited = once(child, "exit");
    child.kill();
    await exited;
  }
  rmSync(siteDir, { recursive: true, force: true });
});

test("the packaged app opens a .wforge passed on the command line", async () => {
  test.skip(executable === undefined, "Packaged builds exist for Windows and macOS only");
  if (executable === undefined) {
    return;
  }
  expect(existsSync(executable), `Missing ${executable}: run pnpm e2e:packaged`).toBe(true);
  const path = join(siteDir, "Packaged check.wforge");
  ProjectStore.create(path, { name: "Packaged check" }).close();

  // Port 0: Chromium picks a free port and prints the URL.
  child = spawn(executable, [path, "--remote-debugging-port=0"], {
    stdio: ["ignore", "ignore", "pipe"],
  });
  browser = await chromium.connectOverCDP(await devToolsUrl(child));
  const page = await appPage(browser);

  // The main process opened the file at start-up (P1), so better-sqlite3 loaded from
  // app.asar.unpacked inside the packaged, fused app.
  const current = await page.evaluate(() =>
    (
      window as unknown as { webforge: { project: { getCurrent(): Promise<unknown> } } }
    ).webforge.project.getCurrent(),
  );
  expect(current).toEqual({
    name: "Packaged check",
    fileName: "Packaged check.wforge",
    formatVersion: 1,
    syncService: null,
  });
});
