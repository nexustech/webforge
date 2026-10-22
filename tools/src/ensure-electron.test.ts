import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { ensureElectron } from "./ensure-electron.js";

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
