// The installers' size against architecture §10: at most 150 MB each (5.1). CI's Performance job
// builds them nightly on Windows and macOS (NSIS `.exe`, `.dmg`) and runs this on the folder
// electron-builder wrote them to.
//
// Usage: node tools/src/check-installer-size.ts apps/desktop/release
//
// This file has no relative imports so Node can run it directly with type stripping.

import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/** §10's budget for an installer: 150 MB. */
export const INSTALLER_BUDGET_BYTES = 150 * 1024 * 1024;

/** The installers under `dir`, at any depth: Windows' NSIS `.exe` and macOS' `.dmg`, with sizes. */
export function findInstallers(dir: string): { readonly path: string; readonly bytes: number }[] {
  const found: { path: string; bytes: number }[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile() || !/\.(?:exe|dmg)$/i.test(entry.name)) continue;
    // The unpacked app (`win-unpacked`, `Webforge.app`) holds programs, not installers.
    if (/-unpacked|\.app(?:[\\/]|$)/.test(entry.parentPath)) continue;
    const path = join(entry.parentPath, entry.name);
    found.push({ path, bytes: statSync(path).size });
  }
  return found.sort((a, b) => (a.path < b.path ? -1 : 1));
}

/** What to print about `installers`, and whether they're all within the budget. */
export function checkInstallers(
  installers: readonly { readonly path: string; readonly bytes: number }[],
): { readonly ok: boolean; readonly message: string } {
  if (installers.length === 0) {
    return { ok: false, message: "No installer was found: build one first." };
  }
  const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  const lines = installers.map(
    ({ path, bytes }) =>
      `${bytes > INSTALLER_BUDGET_BYTES ? "OVER" : "ok  "} ${path}: ${mb(bytes)} (budget ${mb(INSTALLER_BUDGET_BYTES)})`,
  );
  return {
    ok: installers.every(({ bytes }) => bytes <= INSTALLER_BUDGET_BYTES),
    message: lines.join("\n"),
  };
}

/** What the command line gives for `args`: the message, and the exit code (2: no folder named). */
export function checkFromArgs(args: readonly string[]): {
  readonly code: number;
  readonly message: string;
} {
  const [dir] = args;
  if (dir === undefined) {
    return {
      code: 2,
      message: "Usage: node tools/src/check-installer-size.ts <folder with the installers>",
    };
  }
  const { ok, message } = checkInstallers(findInstallers(dir));
  return { code: ok ? 0 : 1, message };
}

if (import.meta.main) {
  const { code, message } = checkFromArgs(process.argv.slice(2));
  (code === 0 ? console.log : console.error)(message);
  process.exitCode = code;
}
