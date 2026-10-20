import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type ElectronApplication, _electron as electron } from "@playwright/test";

/** The desktop app's folder; its production build is in `out/`. */
export const desktopDir = join(import.meta.dirname, "../../apps/desktop");
const desktopPackageJson = join(desktopDir, "package.json");

/** Version of the desktop app, as the main process reports it through `app.getVersion()`. */
export const desktopVersion: string = (
  JSON.parse(readFileSync(desktopPackageJson, "utf8")) as { version: string }
).version;

/**
 * Launches the built desktop app (`apps/desktop/out`) with the Electron version the app depends on.
 * The app runs as it does in production: it loads the renderer from file://, not a dev server.
 */
export async function launchDesktopApp(
  options: {
    /** Extra command-line arguments, e.g. a `.wforge` path as a double-click passes it. */
    readonly args?: readonly string[];
    /**
     * The app's user-data folder (preferences, backups, crash reports). Each launch gets a new
     * temporary one by default, so tests and parallel runs from other worktrees never share
     * state or block each other; pass the same folder to relaunch "the same installation".
     */
    readonly userDataDir?: string;
  } = {},
): Promise<ElectronApplication> {
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
  const userDataDir = options.userDataDir ?? mkdtempSync(join(tmpdir(), "webforge-user-data-"));
  const launched = await electron.launch({
    executablePath,
    args: [desktopDir, `--user-data-dir=${userDataDir}`, ...(options.args ?? [])],
    cwd: desktopDir,
    env,
  });
  if (options.userDataDir === undefined) {
    // Best effort: Chromium may still hold a file for a moment after the app exits.
    launched.once("close", () => {
      try {
        rmSync(userDataDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
      } catch {
        // Left in the temp folder for the OS to clean up.
      }
    });
  }
  return launched;
}
