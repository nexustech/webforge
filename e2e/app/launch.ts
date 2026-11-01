import { type ChildProcess, execFileSync, spawn } from "node:child_process";
import { once } from "node:events";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { rm } from "node:fs/promises";
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
  // Main's AI bridge on its globals, for ai-commands.spec.ts (E2E_AI_VARIABLE in main's ai-ipc.ts),
  // a line on stderr once it has closed (E2E_CLOSED_VARIABLE in main's e2e-closed.ts, #534), and
  // Download and bundle's network stood in for, so no test reaches another website
  // (E2E_BUNDLE_VARIABLE in main's bundle-download.ts, 3.9).
  return {
    executablePath,
    env: {
      ...env,
      WEBFORGE_E2E_AI: "1",
      WEBFORGE_E2E_CLOSED: "1",
      WEBFORGE_E2E_BUNDLE: "1",
      WEBFORGE_E2E_FONTS: "1",
    },
  };
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
): Promise<WebforgeApp> {
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
        rm(folder, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }).catch(() => {
          // Left in the temp folder; the OS cleans it up eventually.
        });
      }
    });
  }
  return closingWithin(app);
}

/**
 * How long closing the app may take before its process is killed (#393). The app's own close (its
 * last save, the Recent thumbnail, closing the site file, quitting) takes under a second, and at
 * most about 13 s when its renderer doesn't answer. On a busy machine, Electron then took up to a
 * minute more to tear the process down after quitting, past the test's timeout.
 */
const CLOSE_TIMEOUT_MS = 30_000;

/** How long a process told to end (SIGTERM) may take before it is killed outright (SIGKILL). */
const KILL_TIMEOUT_MS = 5_000;

/**
 * How long the process may take to exit once Webforge says it has closed, before it is ended. All
 * that's left by then is Electron's teardown, which took 0.4–7 s on a quiet machine and 4–80 s on
 * a busy one (#534); the tests needn't wait for it.
 */
const TEARDOWN_GRACE_MS = 2_000;

/** What Webforge writes to stderr once it has closed (`E2E_CLOSED_LINE` in main's e2e-closed.ts). */
const CLOSED_LINE = "[webforge] closed";

/** An app from {@link closingWithin}: its `close()`, and a wait for it to close by itself. */
export type ClosingApp<App> = App & {
  /**
   * Waits until the app has closed by itself, as when its window is closed or it is told to quit
   * (call it first, then close the window), and ends its process as `close()` does.
   */
  untilClosed(): Promise<void>;
};

/** A launched Webforge, as {@link launchDesktopApp} returns it. */
export type WebforgeApp = ClosingApp<ElectronApplication>;

/**
 * Ends `child` and, on Windows, every process it started: there, ending a process leaves its
 * children running, and an orphaned renderer or GPU process keeps the test's folders busy (EPERM).
 * Elsewhere Electron's helpers end with their parent. `force` kills outright (SIGKILL), which
 * Windows' `taskkill /F` always does.
 */
function endProcess(child: ChildProcess, force = false): void {
  if (process.platform === "win32" && child.pid !== undefined) {
    try {
      execFileSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
    } catch {
      // Gone already, or exiting.
    }
    return;
  }
  child.kill(force ? "SIGKILL" : "SIGTERM");
}

/** Resolves once `child` writes Webforge's closed line to stderr; never without one. */
function closedLine(child: ChildProcess | undefined): Promise<void> {
  return new Promise((resolve) => {
    let seen = "";
    child?.stderr?.on("data", (data: Buffer) => {
      // A line can arrive in pieces; keep only the tail a split line could start in.
      seen = `${seen}${data.toString()}`;
      if (seen.includes(CLOSED_LINE)) resolve();
      seen = seen.slice(-CLOSED_LINE.length);
    });
  });
}

/**
 * `app`, its `close()` quitting it as Playwright's does, then ending its process once Webforge
 * says it has closed (its window gone, its site saved and closed) and the process hasn't exited
 * {@link TEARDOWN_GRACE_MS} later: only Electron's teardown is left by then (#534). An app that
 * never says so is killed once `timeoutMs` has passed. A process that doesn't end when told to
 * (SIGTERM) is killed outright (SIGKILL) `killTimeoutMs` later, so one stuck in its teardown can't
 * outlast the test either. Closing it again (a test that closes it, then its `afterEach`) waits for
 * the first close.
 */
export function closingWithin<App extends Pick<ElectronApplication, "close" | "process">>(
  app: App,
  timeoutMs = CLOSE_TIMEOUT_MS,
  killTimeoutMs = KILL_TIMEOUT_MS,
): ClosingApp<App> {
  const close = app.close.bind(app);
  let started: ChildProcess | undefined;
  try {
    started = app.process();
  } catch {
    // Playwright's app has no process once it has closed by itself.
  }
  // Listened for from the launch on, so a line written before a test waits isn't missed.
  const announced = closedLine(started);
  let closed: Promise<void> | undefined;

  /** Starts `closing` and waits for it (given the process's exit), ending the process as above. */
  const settle = async (closing: (exited: Promise<void>) => Promise<void>) => {
    let child: ChildProcess;
    try {
      child = app.process();
    } catch {
      // Playwright's app has no process once it has closed by itself (a launch that handed its
      // site to a running Webforge): there is nothing left to close.
      return closing(Promise.resolve());
    }
    const exited =
      child.exitCode !== null || child.signalCode !== null
        ? Promise.resolve()
        : once(child, "exit").then(() => undefined);
    const done = closing(exited);
    const timers: ReturnType<typeof setTimeout>[] = [];
    /** Resolves with true after `ms`. */
    const after = (ms: number) =>
      new Promise<true>((resolve) => {
        timers.push(setTimeout(() => resolve(true), ms));
      });
    try {
      const ending = await Promise.race([
        done.then(() => "done" as const),
        announced.then(() => after(TEARDOWN_GRACE_MS)).then(() => "torn down slowly" as const),
        after(timeoutMs).then(() => "late" as const),
      ]);
      if (ending === "done") return;
      // Playwright's close settles once the process is gone; nothing waits on it after this.
      done.catch(() => undefined);
      endProcess(child);
      if (await Promise.race([exited.then(() => false), after(killTimeoutMs)])) {
        endProcess(child, true);
        await exited;
      }
    } finally {
      for (const timer of timers) clearTimeout(timer);
    }
  };
  const closing = app as ClosingApp<App>;
  closing.close = () => {
    closed ??= settle(() => close());
    return closed;
  };
  closing.untilClosed = () => {
    // Done when the process has exited by itself.
    closed ??= settle((exited) => exited);
    return closed;
  };
  return closing;
}

/**
 * How long the app may take from its window opening to its first screen, the editor or the start
 * screen: the renderer loads and draws. Under a second on the developer's computer, but a cold
 * start on a busy Windows runner went past Playwright's 5 s default (#678). For a test's first wait
 * after a launch; {@link waitForCanvas} waits for the canvas too.
 */
export const APP_START_TIMEOUT_MS = 30_000;

/**
 * How long the app may take from its window opening to a canvas showing the site with its CSS: the
 * renderer loads, the canvas mounts, and the canvas styles worker compiles the site's Tailwind CSS
 * for the first time. That is a few seconds on the developer's computer, but the first compile on a
 * cold, busy CI runner went past Playwright's 5 s default (#296, Windows). The one place to tune it.
 */
const CANVAS_START_TIMEOUT_MS = 30_000;

/**
 * Waits until `page`'s canvas shows the site with its compiled CSS (1.12) and the fonts it uses.
 * Both change the layout when they arrive (a heading set in its font is wider or narrower), so
 * clicks, hovers, drags and measurements wait for them.
 */
export async function waitForCanvas(page: Page): Promise<void> {
  const canvas = page.frameLocator(".editor__canvas iframe");
  await expect(canvas.locator("style[data-webforge-site-css]")).toHaveCount(1, {
    timeout: CANVAS_START_TIMEOUT_MS,
  });
  // A frame first: the styles have to be applied before the fonts they use start loading, and
  // `fonts.ready` resolves at once while nothing is loading yet.
  await canvas
    .locator("body")
    .evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => void document.fonts.ready.then(() => resolve())),
        ),
    );
}
