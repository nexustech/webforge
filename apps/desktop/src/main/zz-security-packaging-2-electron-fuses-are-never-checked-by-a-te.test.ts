// Security review S15 (docs/reviews/2026-10-30-security-review.md), restored by #655: the fuses
// as electron-builder.yml sets them. e2e/packaged reads them from the packaged executable too.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Spec §3 Fuses, as electron-builder.yml should set them: the secure state.
const required: Record<string, boolean> = {
  runAsNode: false,
  enableCookieEncryption: true,
  enableNodeOptionsEnvironmentVariable: false,
  enableNodeCliInspectArguments: false,
  enableEmbeddedAsarIntegrityValidation: true,
  onlyLoadAppFromAsar: true,
  grantFileProtocolExtraPrivileges: false,
};

function fuseBlock(): Record<string, string> {
  const yml = readFileSync(join(import.meta.dirname, "../../electron-builder.yml"), "utf8");
  const block = /^electronFuses:\n((?:[ \t]+.*\n|\s*\n)+)/m.exec(yml)?.[1] ?? "";
  return Object.fromEntries(
    [...block.matchAll(/^\s+(\w+):\s*(\S+)/gm)].map((m) => [m[1] ?? "", m[2] ?? ""]),
  );
}

describe("electronFuses", () => {
  it.each(Object.entries(required))("sets %s to %s", (key, value) => {
    expect(fuseBlock()[key]).toBe(String(value));
  });
});
