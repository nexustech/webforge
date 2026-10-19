import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach } from "vitest";

/**
 * Creates fresh temporary directories for one test (call it at the top of a `describe`); each is
 * deleted after the test that created it.
 */
export function tempDirFactory(prefix = "webforge-test-"): () => string {
  const dirs: string[] = [];
  afterEach(() => {
    for (const dir of dirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });
  return () => {
    const dir = mkdtempSync(join(tmpdir(), prefix));
    dirs.push(dir);
    return dir;
  };
}
