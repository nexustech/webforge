import { spawn } from "node:child_process";
import { once } from "node:events";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  type ElectronApplication,
  _electron as electron,
  expect,
  type Page,
} from "@playwright/test";
import { ProjectStore } from "@webforge/storage";

/** The desktop app's folder; its production build is in `out/`. */
export const desktopDir = join(import.meta.dirname, "../../apps/desktop");
const desktopPackageJson = join(desktopDir, "package.json");

/** Version of the desktop app, as the main process reports it through `app.getVersion()`. */
export const desktopVersion: string = (
  JSON.parse(readFileSync(desktopPackageJson, "utf8")) as { version: string }
).version;

/** A fresh folder for the app's user data (preferences, credentials), so tests never share one. */
export function newUserDataDir(): string {
  return mkdtempSync(join(tmpdir(), "webforge-e2e-user-"));
}

/** The Electron binary the app depends on, and an environment that runs its production build. */
function electronCommand(): { executablePath: string; env: Record<string, string> } {
  if (!existsSync(join(desktopDir, "out/main/index.js"))) {
    throw new Error("apps/desktop is not built: run `pnpm e2e` from the repository root");
  }
  // The electron package exports the path of its binary (downloaded on first use).
  const executablePath = String(createRequire(desktopPackageJson)("electron"));
  // Never point the app at a dev server, even if one is set in the shell.
  const env = Object.fromEntries(
    Object.entries(process.env).filter(
      (entry): entry is [string, string] =>
        entry[1] !== undefined && entry[0] !== "ELECTRON_RENDERER_URL",
    ),
  );
  return { executablePath, env };
}

/**
 * Starts Webforge again while it runs, with the same user data, as a double-click on a `.wforge`
 * does (1.8). The new launch hands its command line to the running app and quits; this resolves
 * with its exit code.
 */
export async function launchSecondInstance(options: {
  readonly args: readonly string[];
  readonly userDataDir: string;
}): Promise<number | null> {
  const { executablePath, env } = electronCommand();
  const child = spawn(
    executablePath,
    [desktopDir, `--user-data-dir=${options.userDataDir}`, ...options.args],
    { cwd: desktopDir, env, stdio: "ignore" },
  );
  const [code] = (await once(child, "exit")) as [number | null];
  return code;
}

/**
 * Launches the built desktop app (`apps/desktop/out`) with the Electron version the app depends on.
 * The app runs as it does in production: it loads the renderer from file://, not a dev server.
 * Its user data goes to `userDataDir`, never the tester's own. Without one, it gets a new
 * temporary folder that is deleted when the app closes; a test that restarts the app passes its
 * own folder (from {@link newUserDataDir}) and deletes it.
 *
 * Without a `.wforge` in `args`, the app opens a new, empty site file (in its own temporary
 * folder), as if the user had just created one, so it starts in the editor with the starter site.
 * `site: false` starts it without one, on the start screen (1.8).
 */
export async function launchDesktopApp(
  options: {
    /** Extra command-line arguments, e.g. a `.wforge` path as a double-click passes it. */
    readonly args?: readonly string[];
    /** Where the app keeps its user data; a new temporary folder by default. */
    readonly userDataDir?: string;
    /** Whether to open a new, empty site when `args` name none; true by default. */
    readonly site?: boolean;
  } = {},
): Promise<ElectronApplication> {
  const { executablePath, env } = electronCommand();
  const userData = options.userDataDir ?? newUserDataDir();
  const args = [...(options.args ?? [])];
  let siteDir: string | undefined;
  if (options.site !== false && !args.some((arg) => arg.toLowerCase().endsWith(".wforge"))) {
    siteDir = mkdtempSync(join(tmpdir(), "webforge-e2e-site-"));
    const sitePath = join(siteDir, "My site.wforge");
    ProjectStore.create(sitePath, { name: "My site" }).close();
    args.push(sitePath);
  }
  const app = await electron.launch({
    executablePath,
    args: [desktopDir, `--user-data-dir=${userData}`, ...args],
    cwd: desktopDir,
    env,
  });
  const temporary = [
    ...(options.userDataDir === undefined ? [userData] : []),
    ...(siteDir === undefined ? [] : [siteDir]),
  ];
  if (temporary.length > 0) {
    app.on("close", () => {
      for (const folder of temporary) {
        // Best effort: after a killed app, its helper processes can hold files for a moment.
        try {
          rmSync(folder, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
        } catch {
          // Left in the temp folder; the OS cleans it up eventually.
        }
      }
    });
  }
  return app;
}

/**
 * How long the app may take from its window opening to a canvas showing the site with its CSS: the
 * renderer loads, the canvas mounts, and the canvas styles worker compiles the site's Tailwind CSS
 * for the first time. That is a few seconds on the developer's computer, but the first compile on a
 * cold, busy CI runner went past Playwright's 5 s default (#296, Windows). The one place to tune it.
 */
export const CANVAS_START_TIMEOUT_MS = 30_000;

/**
 * Waits until `page`'s canvas shows the site with its compiled CSS (1.12). The CSS changes the
 * layout when it arrives, so clicks, drags and measurements wait for it.
 */
export async function waitForCanvas(page: Page): Promise<void> {
  await expect(
    page.frameLocator(".editor__canvas iframe").locator("style[data-webforge-site-css]"),
  ).toHaveCount(1, { timeout: CANVAS_START_TIMEOUT_MS });
}
