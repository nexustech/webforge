import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach } from "vitest";

/** Creates a fresh temporary directory for one test; it is deleted after the test. */
export function tempDirFactory(): () => string {
  const dirs: string[] = [];
  afterEach(() => {
    for (const dir of dirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });
  return () => {
    const dir = mkdtempSync(join(tmpdir(), "webforge-storage-"));
    dirs.push(dir);
    return dir;
  };
}
