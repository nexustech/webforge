import { type ChildProcess, execFileSync, spawn } from "node:child_process";
import { once } from "node:events";
import { copyFileSync, createReadStream, existsSync, mkdtempSync, statSync } from "node:fs";
import { rm } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { homedir, tmpdir } from "node:os";
import { basename, join } from "node:path";
import { type Browser, chromium, expect, type Page, test } from "@playwright/test";

// Webforge updates itself (0.5a, ADR 0024): an unsigned 0.0.1, installed as a person installs it,
// finds 0.0.2 on a local feed, downloads it in the background, says so, and installs it when it's
// closed. Windows only until macOS updates are signed (0.5b).
//
// It builds two installers from the e2e build `pnpm e2e:packaged` has just made, installs one into
// a folder of its own, and uninstalls it at the end. Installing still registers Webforge for the
// current user: its uninstaller and `.wforge` files, which the uninstall takes back, except for an
// empty `.wforge` key, as it does for anyone. That would also undo a Webforge the developer has
// installed themselves, so it runs only when WEBFORGE_E2E_INSTALL=1: on CI's Windows runner, which
// is thrown away afterwards, and on a developer's computer only when they ask.

const desktopDir = join(import.meta.dirname, "../../apps/desktop");
const runs = process.platform === "win32" && process.env.WEBFORGE_E2E_INSTALL === "1";
/** electron-updater's download folder, named in app-update.yml (`updaterCacheDirName`). */
const updaterCache = join(homedir(), "AppData", "Local", "@webforgedesktop-updater");

let workDir: string;
let installDir: string;
let feed: Server | undefined;
let child: ChildProcess | undefined;
let browser: Browser | undefined;

test.describe.configure({ mode: "serial" });
test.skip(!runs, "Installs Webforge: Windows with WEBFORGE_E2E_INSTALL=1 only");

/**
 * Builds the NSIS installer of `version` from the e2e build in `out/` (the desktop app's
 * `package:installer`), making no shortcuts on the desktop or in the Start menu.
 */
function buildInstaller(version: string): string {
  const output = join(workDir, version);
  execFileSync(
    "pnpm",
    [
      "run",
      "package:installer",
      `-c.extraMetadata.version=${version}`,
      `-c.directories.output=${output}`,
      "-c.nsis.createDesktopShortcut=false",
      "-c.nsis.createStartMenuShortcut=false",
    ],
    { cwd: desktopDir, stdio: "ignore", shell: true },
  );
  return output;
}

/** Serves `dir`'s files over http on this computer: the update feed. */
async function serve(dir: string): Promise<string> {
  const server = createServer((request, response) => {
    const name = basename(decodeURIComponent(new URL(request.url ?? "/", "http://x").pathname));
    const path = join(dir, name);
    if (name === "" || !existsSync(path)) {
      response.writeHead(404).end();
      return;
    }
    response.writeHead(200, { "content-length": statSync(path).size });
    createReadStream(path).pipe(response);
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  feed = server;
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}/`;
}

/** Resolves with the DevTools WebSocket URL Chromium prints to stderr on start-up. */
async function devToolsUrl(started: ChildProcess): Promise<string> {
  const stderr = started.stderr;
  if (stderr === null) throw new Error("The app was started without a stderr pipe");
  let output = "";
  stderr.setEncoding("utf8");
  for await (const chunk of stderr) {
    output += String(chunk);
    const match = /DevTools listening on (ws:\/\/\S+)/.exec(output);
    if (match?.[1] !== undefined) return match[1];
  }
  throw new Error(`The app exited before DevTools started:\n${output}`);
}

/** Starts the installed Webforge with its own user data, and gives its window. */
async function launch(env: NodeJS.ProcessEnv = {}): Promise<Page> {
  child = spawn(
    join(installDir, "Webforge.exe"),
    [`--user-data-dir=${join(workDir, "user-data")}`, "--remote-debugging-port=0"],
    { stdio: ["ignore", "ignore", "pipe"], env: { ...process.env, ...env } },
  );
  browser = await chromium.connectOverCDP(await devToolsUrl(child));
  await expect.poll(() => browser?.contexts().flatMap((context) => context.pages()).length).toBe(1);
  const [page] = browser.contexts().flatMap((context) => context.pages());
  if (page === undefined) throw new Error("Webforge has no window");
  await page.waitForFunction(() => "webforge" in window);
  return page;
}

type Webforge = {
  app: { getInfo(): Promise<{ version: string }> };
  updates: { status(): Promise<{ state: string; version?: string }> };
};
const webforge = (page: Page) => page.evaluate(() => "webforge" in window);
const version = (page: Page) =>
  page.evaluate(
    async () =>
      (await (window as unknown as { webforge: Webforge }).webforge.app.getInfo()).version,
  );
const updateStatus = (page: Page) =>
  page.evaluate(() => (window as unknown as { webforge: Webforge }).webforge.updates.status());

/**
 * The installed Webforge's version as Windows' Apps list has it, which the installer writes as it
 * finishes, and whether an installer is still running: `0.0.1 idle` or `0.0.2 installing`.
 */
const installState = () =>
  execFileSync(
    "powershell.exe",
    [
      "-NoProfile",
      "-Command",
      [
        String.raw`$app = Get-ChildItem HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall`,
        "| ForEach-Object { Get-ItemProperty $_.PSPath }",
        `| Where-Object { $_.UninstallString -like '*${installDir}*' } | Select-Object -First 1;`,
        "$busy = @(Get-Process | Where-Object { $_.ProcessName -like 'Webforge-Setup*' }).Count;",
        "\"$($app.DisplayVersion) $(if ($busy) { 'installing' } else { 'idle' })\"",
      ].join(" "),
    ],
    { encoding: "utf8" },
  ).trim();

/** What Windows runs for a double-clicked `.wforge`, as the installer registered it. */
const wforgeCommand = () =>
  execFileSync(
    "powershell.exe",
    [
      "-NoProfile",
      "-Command",
      [
        String.raw`$type = (Get-ItemProperty 'HKCU:\Software\Classes\.wforge').'(default)';`,
        String.raw`(Get-ItemProperty "HKCU:\Software\Classes\$type\shell\open\command").'(default)'`,
      ].join(" "),
    ],
    { encoding: "utf8" },
  ).trim();

test.beforeAll(async () => {
  // Two installers (a few minutes each), and installing.
  test.setTimeout(15 * 60_000);
  workDir = mkdtempSync(join(tmpdir(), "webforge-update-"));
  installDir = join(workDir, "installed");
  const first = buildInstaller("0.0.1");
  const second = buildInstaller("0.0.2");
  // Beta's feed file, as the release workflow uploads it beside Stable's (5.2, ADR 0024): a
  // version below 1.0.0 follows Beta.
  copyFileSync(join(second, "latest.yml"), join(second, "beta.yml"));
  // Silent, into a folder of the test's own, as electron-builder's per-user installer allows.
  execFileSync(join(first, "Webforge-Setup-0.0.1.exe"), ["/S", `/D=${installDir}`]);
});

/** Ends Webforge and every process it started, as a failed test can leave them. */
async function endWebforge(): Promise<void> {
  await browser?.close();
  browser = undefined;
  if (child?.pid !== undefined && child.exitCode === null) {
    const exited = once(child, "exit");
    execFileSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore" });
    await exited;
  }
}

test.afterAll(async () => {
  test.setTimeout(3 * 60_000);
  await endWebforge();
  feed?.close();
  // An update a failed test left installing finishes first: its installer holds the files.
  await expect
    .poll(() => installState().endsWith("idle"), { timeout: 2 * 60_000, intervals: [2_000] })
    .toBe(true);
  // Uninstalled as Windows' Apps list does it, silently. `_?=` runs the uninstaller where it is,
  // so this waits for it rather than for a copy it starts.
  const uninstaller = join(installDir, "Uninstall Webforge.exe");
  if (existsSync(uninstaller)) {
    execFileSync(uninstaller, ["/currentuser", "/S", `_?=${installDir}`], { timeout: 120_000 });
  }
  await rm(updaterCache, { recursive: true, force: true, maxRetries: 10, retryDelay: 500 });
  await rm(workDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 500 });
});

test("an installed 0.0.1 downloads 0.0.2 from its feed, says so, and installs it when closed", async () => {
  test.setTimeout(5 * 60_000);
  // A double-clicked site opens in Webforge (P1): the packaged app's own test opens one so.
  expect(wforgeCommand()).toBe(`${join(installDir, "Webforge.exe")} "%1"`);
  const page = await launch({ WEBFORGE_E2E_UPDATE_FEED: await serve(join(workDir, "0.0.2")) });
  expect(await version(page)).toBe("0.0.1");

  // The first check is 10 s after the window opens; then the download, in the background.
  await expect
    .poll(() => updateStatus(page), { timeout: 3 * 60_000, intervals: [1_000] })
    .toEqual({ state: "downloaded", version: "0.0.2" });
  await expect(
    page.getByText("Webforge 0.0.2 is ready: it installs when you close Webforge."),
  ).toBeVisible();
  expect(installState()).toBe("0.0.1 idle");

  // Closed as the person closes it: the installer starts once Webforge has closed its site.
  const exited = once(child as ChildProcess, "exit");
  await page.evaluate(() => window.close());
  await exited;
  await endWebforge();
  await expect.poll(installState, { timeout: 2 * 60_000, intervals: [2_000] }).toBe("0.0.2 idle");

  // The new version starts, with no update left to install.
  const updated = await launch();
  expect(await webforge(updated)).toBe(true);
  expect(await version(updated)).toBe("0.0.2");
});
