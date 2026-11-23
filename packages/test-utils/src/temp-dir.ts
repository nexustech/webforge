import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach } from "vitest";

/**
 * How a test's temporary folder is removed: tried again, five times, 100 ms apart, as Windows
 * can refuse a moment while a file in it is still open or being read (ENOTEMPTY, EBUSY, #1353).
 * Node tries only once unless asked.
 */
export const TEST_DIR_REMOVAL = {
  recursive: true,
  force: true,
  maxRetries: 5,
  retryDelay: 100,
} as const;

/**
 * Creates fresh temporary directories for one test (call it at the top of a `describe`); each is
 * deleted after the test that created it.
 */
export function tempDirFactory(prefix = "webforge-test-"): () => string {
  const dirs: string[] = [];
  afterEach(() => {
    for (const dir of dirs.splice(0)) {
      rmSync(dir, TEST_DIR_REMOVAL);
    }
  });
  return () => {
    const dir = mkdtempSync(join(tmpdir(), prefix));
    dirs.push(dir);
    return dir;
  };
}
