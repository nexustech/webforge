import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { IpcMain } from "electron";
import { type LicencesResult, noticesFileSchema } from "../shared/ipc/app.js";
import { registerIpcHandler } from "./ipc.js";
import { logFailure } from "./log.js";

/** Where the app's licences are: its build's notices, and Chromium's own. */
export type LicenceFiles = {
  /** The folder the build wrote the notices into (`out/notices`, beside app.asar once packaged). */
  readonly noticesDir: string;
  /** Electron's LICENSES.chromium.html. */
  readonly chromium: string;
};

/**
 * Where the licences are: in development, the build's `out/notices` and Electron's own copy of
 * Chromium's; packaged, the notices beside app.asar, and Chromium's where electron-builder puts it:
 * beside the program on Windows, and in a Mac app's Resources (electron-builder 26.18 and later,
 * #831; a hook of ours copied it there before).
 */
export function licenceFiles(options: {
  readonly packaged: boolean;
  readonly platform: NodeJS.Platform;
  readonly appPath: string;
  readonly resourcesPath: string;
  readonly execDir: string;
}): LicenceFiles {
  const { packaged, platform, appPath, resourcesPath, execDir } = options;
  if (!packaged) {
    return {
      noticesDir: join(appPath, "out", "notices"),
      chromium: join(appPath, "node_modules", "electron", "dist", "LICENSES.chromium.html"),
    };
  }
  const noticesDir = join(resourcesPath, "notices");
  return {
    noticesDir,
    chromium:
      platform === "darwin"
        ? join(resourcesPath, "LICENSES.chromium.html")
        : join(execDir, "LICENSES.chromium.html"),
  };
}

/**
 * Registers Help → Open-Source Licences' calls (5.3, C1): `app:list-licences`, the packages the
 * app ships from its build's notices, read once and checked; and `app:open-chromium-licences`,
 * which opens Chromium's licences with `openPath` (`shell.openPath`, which gives an error's
 * message, or nothing once opened).
 */
export function registerLicenceHandlers(
  ipc: Pick<IpcMain, "handle">,
  isTrustedSender: (senderUrl: string) => boolean,
  files: LicenceFiles,
  openPath: (path: string) => Promise<string>,
): void {
  let listed: Promise<LicencesResult> | undefined;
  const list = async (): Promise<LicencesResult> => {
    try {
      const text = await readFile(join(files.noticesDir, "notices.json"), "utf8");
      return { status: "listed", ...noticesFileSchema.parse(JSON.parse(text)) };
    } catch (error) {
      logFailure("Webforge could not read its third-party notices", error);
      return { status: "failed" };
    }
  };
  registerIpcHandler(ipc, "listLicences", isTrustedSender, async () => {
    // The notices don't change while the app runs; one that failed is tried again.
    listed ??= list();
    const result = await listed;
    if (result.status === "failed") listed = undefined;
    return result;
  });
  registerIpcHandler(ipc, "openChromiumLicences", isTrustedSender, async () => {
    try {
      return (await openPath(files.chromium)) === "";
    } catch {
      return false;
    }
  });
}
