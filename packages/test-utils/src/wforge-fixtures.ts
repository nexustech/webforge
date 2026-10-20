import { copyFileSync } from "node:fs";
import { join } from "node:path";

const FIXTURES = join(import.meta.dirname, "../fixtures/wforge");

/**
 * Copies the `.wforge` fixture of a released format version into `dir` and returns the copy's
 * path, so a test can open (and migrate) it without changing the fixture. One fixture exists per
 * format version and none is ever deleted: every release must open every older file (standards
 * §5, §10).
 */
export function copyWforgeFixture(version: number, dir: string): string {
  const path = join(dir, `v${version}.wforge`);
  copyFileSync(join(FIXTURES, `v${version}.wforge`), path);
  return path;
}
