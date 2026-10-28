import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { ensureElectron, productNameOf, withBundleName } from "./ensure-electron.js";

describe("ensureElectron", () => {
  it("loads Electron so its binary is downloaded", () => {
    const load = vi.fn();
    expect(ensureElectron({}, load)).toBe(true);
    expect(load).toHaveBeenCalledOnce();
  });

  it("skips Electron when ELECTRON_EXEC_PATH names another one", () => {
    const load = vi.fn();
    expect(ensureElectron({ ELECTRON_EXEC_PATH: "/opt/electron/Electron" }, load)).toBe(false);
    expect(load).not.toHaveBeenCalled();
  });

  it("treats an empty ELECTRON_EXEC_PATH as unset, as electron-vite does", () => {
    const load = vi.fn();
    expect(ensureElectron({ ELECTRON_EXEC_PATH: "" }, load)).toBe(true);
    expect(load).toHaveBeenCalledOnce();
  });
});

// Regression: on a fresh clone `pnpm dev` failed with "Electron uninstall" because nothing had
// downloaded the binary. CI doesn't catch it, as its Playwright tests download Electron themselves.
describe("desktop scripts", () => {
  const { scripts } = JSON.parse(
    readFileSync(new URL("../../apps/desktop/package.json", import.meta.url), "utf8"),
  ) as { scripts: Record<string, string> };

  it("runs this guard", () => {
    expect(scripts["ensure-electron"]).toBe("node ../../tools/src/ensure-electron.ts");
  });

  it.each(["dev", "preview"])("ensures Electron before electron-vite %s starts it", (name) => {
    expect(scripts[name]).toBe(`pnpm run ensure-electron && electron-vite ${name}`);
  });
});

// #450: in development, macOS names the app after the running bundle, Electron's own.
describe("the development Electron bundle's name", () => {
  const PLIST = [
    "<plist><dict>",
    "\t<key>CFBundleExecutable</key>",
    "\t<string>Electron</string>",
    "\t<key>CFBundleName</key>",
    "\t<string>Electron</string>",
    "</dict></plist>",
  ].join("\n");

  it("reads the product name from electron-builder's config", () => {
    const config = readFileSync(
      new URL("../../apps/desktop/electron-builder.yml", import.meta.url),
      "utf8",
    );
    expect(productNameOf(config)).toBe("Webforge");
    expect(productNameOf("appId: x\n")).toBeUndefined();
  });

  it("names the bundle and gives it a display name, leaving the rest", () => {
    const named = withBundleName(PLIST, "Webforge");

    expect(named).toContain("<key>CFBundleName</key>\n\t<string>Webforge</string>");
    expect(named).toContain("<key>CFBundleDisplayName</key>\n\t<string>Webforge</string>");
    expect(named).toContain("<key>CFBundleExecutable</key>\n\t<string>Electron</string>");
  });

  it("is the same when named again, and escapes the name", () => {
    const named = withBundleName(PLIST, "Webforge");
    expect(withBundleName(named, "Webforge")).toBe(named);
    expect(withBundleName(named, "Forge & $1 <Co>")).toContain(
      "<string>Forge &amp; $1 &lt;Co&gt;</string>",
    );
  });
});
