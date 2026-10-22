// Electron download guard for the desktop app's dev and preview scripts.
//
// Usage (see the "ensure-electron" script in apps/desktop/package.json):
//   node ../../tools/src/ensure-electron.ts
//
// Electron 44 has no install script: it downloads its binary the first time `require("electron")`
// runs. electron-vite 6 reads Electron's path.txt directly instead, so on a fresh clone it fails
// with "Electron uninstall". Requiring Electron first downloads the binary when it is missing and
// does nothing otherwise. electron-vite uses ELECTRON_EXEC_PATH when it is set, so then nothing is
// downloaded.
//
// This file has no relative imports so Node can run it directly with type stripping.

import { createRequire } from "node:module";
import { join } from "node:path";

/**
 * Loads Electron (which downloads its binary if needed) unless ELECTRON_EXEC_PATH names another
 * Electron for electron-vite to run. Returns whether Electron was loaded.
 */
export function ensureElectron(env: NodeJS.ProcessEnv, loadElectron: () => unknown): boolean {
  if (env.ELECTRON_EXEC_PATH) {
    return false;
  }
  loadElectron();
  return true;
}

if (import.meta.main) {
  // Resolve Electron from the package running the script (apps/desktop), not from tools.
  ensureElectron(process.env, () => createRequire(join(process.cwd(), "package.json"))("electron"));
}
