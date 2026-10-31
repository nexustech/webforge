import { type ChildProcess, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { once } from "node:events";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type Browser, chromium, expect, type Page, test } from "@playwright/test";
import { ProjectStore } from "@webforge/storage";
import { BLANK_TEMPLATE_ID, TEMPLATE_IDS } from "@webforge/templates";
import { FONT_BUDGET_BYTES, FONT_CATALOGUE } from "@webforge/themes";
import { desktopVersion } from "../app/launch.js";
import { startSftpServer } from "./sftp-server.js";

// Checks the packaged app (`pnpm e2e:packaged`): electron-builder output with asar, Fuses and the
// unpacked better-sqlite3 binary. Fuses switch off --inspect, so Playwright's Electron launcher
// can't attach; the test starts the executable itself and connects over the Chrome DevTools
// Protocol, which reaches the renderer only. `pnpm e2e:packaged` builds it with `--mode e2e`, so
// the native file dialogs answer from the file WEBFORGE_E2E_DIALOGS names (ADR 0005).

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

/** The packaged app's resources folder, beside app.asar. */
function resourcesDir(): string | undefined {
  switch (process.platform) {
    case "win32":
      return join(releaseDir, "win-unpacked", "resources");
    case "darwin":
      return join(releaseDir, `mac-${process.arch}`, "Webforge.app", "Contents", "Resources");
    default:
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
  // Fully loaded, so a later load event is a reload.
  await page.waitForLoadState("load");
  return page;
}

/** The renderer's `window.webforge.project`, as far as these tests call it. */
type ProjectApi = {
  getCurrent(): Promise<unknown>;
  create(request: { name: string; theme: string }): Promise<{ status: string }>;
};

/** The renderer's `window.webforge.publish`, as far as these tests call it (4.3). */
type PublishApi = {
  readHostKey(
    host: string,
    port: number,
  ): Promise<{ status: "read"; hostKey: string } | { status: "failed"; code: string }>;
  testConnection(destination: unknown, signIn: unknown, trust: unknown): Promise<unknown>;
};

const currentProject = (page: Page) =>
  page.evaluate(() =>
    (window as unknown as { webforge: { project: ProjectApi } }).webforge.project.getCurrent(),
  );

/** The open site as `project.getCurrent` reports it; each opening has its own session id (R6). */
const summary = (name: string) => ({
  sessionId: expect.stringMatching(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
  ),
  name,
  fileName: `${name}.wforge`,
  formatVersion: 1,
  syncService: null,
});

const executable = packagedExecutable();
let siteDir: string;
let userData: string;
let dialogAnswers: string;
let child: ChildProcess | undefined;
let browser: Browser | undefined;
let page: Page;

test.describe.configure({ mode: "serial" });

test.beforeAll(() => {
  siteDir = mkdtempSync(join(tmpdir(), "webforge-packaged-"));
  // Never the tester's own preferences, Recent list or single-instance lock.
  userData = join(siteDir, "user-data");
  dialogAnswers = join(siteDir, "dialogs.json");
  writeFileSync(dialogAnswers, "{}");
});

test.afterAll(async () => {
  await browser?.close();
  if (child !== undefined && child.exitCode === null) {
    const exited = once(child, "exit");
    child.kill();
    await exited;
  }
  // On Windows the app's helper processes can hold the folder for a moment after it exits.
  await rm(siteDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
});

test("ships every catalogue font beside app.asar, byte for byte, within the font budget (2.2)", () => {
  const dir = resourcesDir();
  test.skip(dir === undefined, "Linux is not a release target");
  if (dir === undefined) return;
  let total = 0;
  for (const file of FONT_CATALOGUE.flatMap((font) => font.files)) {
    const data = readFileSync(join(dir, "fonts", file.file));
    expect(createHash("sha256").update(data).digest("hex"), file.file).toBe(file.sha256);
    total += data.byteLength;
  }
  expect(total).toBeLessThanOrEqual(FONT_BUDGET_BYTES);
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
  child = spawn(executable, [path, `--user-data-dir=${userData}`, "--remote-debugging-port=0"], {
    stdio: ["ignore", "ignore", "pipe"],
    env: { ...process.env, WEBFORGE_E2E_DIALOGS: dialogAnswers },
  });
  browser = await chromium.connectOverCDP(await devToolsUrl(child));
  page = await appPage(browser);

  // The main process opened the file at start-up (P1), so better-sqlite3 loaded from
  // app.asar.unpacked inside the packaged, fused app.
  expect(await currentProject(page)).toEqual(summary("Packaged check"));
});

test("a .wforge double-clicked while the app runs opens in the running window (1.8)", async () => {
  test.skip(executable === undefined || child === undefined, "Needs the running packaged app");
  if (executable === undefined) {
    return;
  }
  const path = join(siteDir, "Handed over.wforge");
  ProjectStore.create(path, { name: "Handed over" }).close();

  // As Explorer or Finder starts it: just the file. It hands the file over and quits.
  const reloaded = page.waitForEvent("load");
  const second = spawn(executable, [path, `--user-data-dir=${userData}`], { stdio: "ignore" });
  const [code] = (await once(second, "exit")) as [number | null];
  await reloaded;

  expect(code).toBe(0);
  expect(browser?.contexts().flatMap((context) => context.pages())).toHaveLength(1);
  // The reloaded renderer may still be starting.
  await expect(async () => {
    expect(await currentProject(page)).toEqual(summary("Handed over"));
  }).toPass();
});

test("answers the native file dialogs from the test's file in e2e builds (ADR 0005)", async () => {
  test.skip(child === undefined, "Needs the running packaged app");
  const path = join(siteDir, "From the dialog.wforge");
  writeFileSync(dialogAnswers, JSON.stringify({ save: path }));

  const result = await page.evaluate(() =>
    (window as unknown as { webforge: { project: ProjectApi } }).webforge.project.create({
      name: "From the dialog",
      theme: "light",
    }),
  );

  expect(result).toEqual({ status: "opened", project: summary("From the dialog") });
  expect(existsSync(path)).toBe(true);
});

test("ships the templates beside app.asar, and New Site lists them (2.14a)", async () => {
  test.skip(child === undefined, "Needs the running packaged app");
  const dir = resourcesDir();
  if (dir !== undefined) {
    expect(existsSync(join(dir, "templates", "cafe", "template.json"))).toBe(true);
    // New Site makes the Blank template when no template is chosen (2.15c).
    expect(existsSync(join(dir, "templates", "blank", "template.json"))).toBe(true);
  }

  const listed = await page.evaluate(() =>
    (
      window as unknown as { webforge: { templates: { list(): Promise<{ id: string }[]> } } }
    ).webforge.templates.list(),
  );

  // Every template but Blank, which New Site offers on its own (2.15c).
  expect(listed.map((template) => template.id)).toEqual(
    TEMPLATE_IDS.filter((id) => id !== BLANK_TEMPLATE_ID),
  );
});

test("signs in over SFTP with ssh2's JavaScript, no native module to rebuild (4.3, ADR 0006)", async () => {
  test.skip(child === undefined, "Needs the running packaged app");
  const server = await startSftpServer({ user: "baker", password: "test-only-password" });
  try {
    // The host's key first, as the destination form trusts it, then Test connection with it.
    const result = await page.evaluate(async (port) => {
      const { publish } = (window as unknown as { webforge: { publish: PublishApi } }).webforge;
      const read = await publish.readHostKey("127.0.0.1", port);
      if (read.status !== "read") return read;
      return publish.testConnection(
        {
          protocol: "sftp",
          host: "127.0.0.1",
          port,
          user: "baker",
          folder: "/site",
          signIn: "password",
        },
        { password: "test-only-password" },
        // Trusted on this computer, never in the site's file (S2).
        { hostKey: read.hostKey },
      );
    }, server.port);

    expect(result).toEqual({ ok: true });
  } finally {
    await server.stop();
  }
  // No native module of ssh2's ships: no crypto binding, built or not, and no cpu-features.
  const dir = resourcesDir();
  if (dir !== undefined) {
    const unpacked = join(dir, "app.asar.unpacked", "node_modules");
    const ssh2Files = existsSync(join(unpacked, "ssh2"))
      ? readdirSync(join(unpacked, "ssh2"), { recursive: true, encoding: "utf8" })
      : [];
    expect(ssh2Files.filter((file) => /\.node$|binding\.gyp$/.test(file))).toEqual([]);
    expect(existsSync(join(unpacked, "cpu-features"))).toBe(false);
  }
});

// Last: it quits the app.
test("leaves no copied images in the user's data once it has quit (R13d)", async () => {
  test.skip(child === undefined, "Needs the running packaged app");
  const running = child;
  if (running === undefined) return;
  // As a copy keeps an image's bytes for pasting into another site (1.25).
  const kept = join(userData, "clipboard");
  mkdirSync(kept, { recursive: true });
  writeFileSync(join(kept, "a".repeat(64)), "bytes");

  // Closed as the person closes it, so Webforge quits through will-quit, not a kill.
  const exited = once(running, "exit");
  await page.evaluate(() => {
    setTimeout(() => window.close(), 0);
  });
  const [code] = (await exited) as [number | null];

  expect(code).toBe(0);
  expect(existsSync(kept)).toBe(false);
});
