import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { checkInstallers, findInstallers, INSTALLER_BUDGET_BYTES } from "./check-installer-size.js";

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "webforge-installers-"));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe("the installers' size (§10, 5.1)", () => {
  it("finds the installers electron-builder wrote, not the unpacked app's programs", () => {
    const release = join(dir, "0.0.0");
    mkdirSync(join(release, "win-unpacked"), { recursive: true });
    mkdirSync(join(release, "mac-arm64", "Webforge.app", "Contents", "MacOS"), { recursive: true });
    writeFileSync(join(release, "Webforge-Setup-0.0.0.exe"), "installer");
    writeFileSync(join(release, "Webforge-0.0.0-arm64.dmg"), "disk image");
    writeFileSync(join(release, "Webforge-Setup-0.0.0.exe.blockmap"), "map");
    writeFileSync(join(release, "win-unpacked", "Webforge.exe"), "program");

    expect(findInstallers(dir).map(({ path, bytes }) => [path, bytes])).toEqual([
      [join(release, "Webforge-0.0.0-arm64.dmg"), 10],
      [join(release, "Webforge-Setup-0.0.0.exe"), 9],
    ]);
  });

  it("passes installers within 150 MB, and fails one over it, or none at all", () => {
    expect(checkInstallers([{ path: "Webforge-Setup.exe", bytes: 98 * 1024 * 1024 }])).toEqual({
      ok: true,
      message: "ok   Webforge-Setup.exe: 98.0 MB (budget 150.0 MB)",
    });
    const over = checkInstallers([{ path: "big.dmg", bytes: INSTALLER_BUDGET_BYTES + 1 }]);
    expect(over.ok).toBe(false);
    expect(over.message).toMatch(/^OVER big\.dmg/);
    expect(checkInstallers([]).ok).toBe(false);
  });
});
