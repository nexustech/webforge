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
// On macOS the first menu, the Dock and the About panel take their name from the running bundle,
// which in development is Electron's own `Electron.app`. So it is named after the product, from
// `productName` in electron-builder.yml (#450): each time, so a reinstalled Electron is named again.
// Editing its Info.plist breaks the bundle's signature, which the keychain items safeStorage keeps
// sign-ins in are tied to, so the bundle is signed again, ad hoc, after each change. Not yet run on
// a Mac.
//
// This file has no relative imports so Node can run it directly with type stripping.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

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

/**
 * The `productName` electron-builder's config gives the installers and the app bundle: a plain or
 * quoted YAML scalar, without a trailing `# comment`.
 */
export function productNameOf(config: string): string | undefined {
  const value = /^productName:[ \t]*(.*)$/m.exec(config)?.[1] ?? "";
  const quoted = /^(["'])(.*?)\1/.exec(value);
  const name = quoted === null ? value.replace(/(^|\s)#.*$/, "").trim() : quoted[2];
  return name === undefined || name === "" ? undefined : name;
}

/** An XML text, escaped for a plist's `<string>`. */
const escaped = (text: string) =>
  text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

/**
 * `plist`, a bundle's Info.plist, with its name and display name `name`: the display name added
 * after the name when it has none.
 */
export function withBundleName(plist: string, name: string): string {
  const value = `<string>${escaped(name)}</string>`;
  const entry = (key: string) => new RegExp(`(<key>${key}</key>\\s*)<string>[^<]*</string>`);
  const set = (text: string, key: string) =>
    text.replace(entry(key), (_, before: string) => `${before}${value}`);
  const named = set(plist, "CFBundleName");
  return entry("CFBundleDisplayName").test(named)
    ? set(named, "CFBundleDisplayName")
    : named.replace(
        entry("CFBundleName"),
        (match) => `${match}\n\t<key>CFBundleDisplayName</key>\n\t${value}`,
      );
}

/**
 * Names the development Electron bundle `name` (macOS only), given the path of its executable,
 * `Electron.app/Contents/MacOS/Electron`, and signs it again, ad hoc, as the change broke its
 * signature (`sign`, given the bundle's path). Returns whether its Info.plist changed.
 */
export function nameElectronBundle(
  executable: string,
  name: string,
  sign: (bundle: string) => void = signAdHoc,
): boolean {
  const contents = dirname(dirname(executable));
  const plist = join(contents, "Info.plist");
  if (!existsSync(plist)) return false;
  const before = readFileSync(plist, "utf8");
  const after = withBundleName(before, name);
  if (after === before) return false;
  writeFileSync(plist, after);
  try {
    sign(dirname(contents));
  } catch {
    // Unsigned, Electron still runs in development; sign-ins may ask for the keychain again.
  }
  return true;
}

/** Signs `bundle` ad hoc, as macOS's `codesign` does for a development build. */
function signAdHoc(bundle: string): void {
  execFileSync("codesign", ["--force", "--deep", "--sign", "-", bundle], { stdio: "ignore" });
}

if (import.meta.main) {
  // Resolve Electron from the package running the script (apps/desktop), not from tools.
  let executable: unknown;
  ensureElectron(process.env, () => {
    executable = createRequire(join(process.cwd(), "package.json"))("electron");
  });
  const name = productNameOf(readFileSync(join(process.cwd(), "electron-builder.yml"), "utf8"));
  if (process.platform === "darwin" && typeof executable === "string" && name !== undefined) {
    nameElectronBundle(executable, name);
  }
}
