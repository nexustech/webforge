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

/** A fresh folder for the app's user data (preferences, credentials), so tests never share one. */
export function newUserDataDir(): string {
  return mkdtempSync(join(tmpdir(), "webforge-e2e-user-"));
}

/**
 * Launches the built desktop app (`apps/desktop/out`) with the Electron version the app depends on.
 * The app runs as it does in production: it loads the renderer from file://, not a dev server.
 * Its user data goes to `userDataDir`, never the tester's own. Without one, it gets a new
 * temporary folder that is deleted when the app closes; a test that restarts the app passes its
 * own folder (from {@link newUserDataDir}) and deletes it.
 */
export async function launchDesktopApp(
  options: {
    /** Extra command-line arguments, e.g. a `.wforge` path as a double-click passes it. */
    readonly args?: readonly string[];
    /** Where the app keeps its user data; a new temporary folder by default. */
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
  const userData = options.userDataDir ?? newUserDataDir();
  const app = await electron.launch({
    executablePath,
    args: [desktopDir, `--user-data-dir=${userData}`, ...(options.args ?? [])],
    cwd: desktopDir,
    env,
  });
  if (options.userDataDir === undefined) {
    app.on("close", () => {
      // Best effort: after a killed app, its helper processes can hold files for a moment.
      try {
        rmSync(userData, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
      } catch {
        // Left in the temp folder; the OS cleans it up eventually.
      }
    });
  }
  return app;
}
