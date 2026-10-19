import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { type ElectronApplication, _electron as electron } from "@playwright/test";

const desktopDir = join(import.meta.dirname, "../../apps/desktop");
const desktopPackageJson = join(desktopDir, "package.json");

/** Version of the desktop app, as the main process reports it through `app.getVersion()`. */
export const desktopVersion: string = (
  JSON.parse(readFileSync(desktopPackageJson, "utf8")) as { version: string }
).version;

/**
 * Launches the built desktop app (`apps/desktop/out`) with the Electron version the app depends on.
 * The app runs as it does in production: it loads the renderer from file://, not a dev server.
 */
export async function launchDesktopApp(): Promise<ElectronApplication> {
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
  return electron.launch({ executablePath, args: [desktopDir], cwd: desktopDir, env });
}
