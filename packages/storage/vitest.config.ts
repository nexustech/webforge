import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    // Integration tests write real SQLite files with synchronous=FULL; every commit waits for
    // fsync, which takes 20x longer on CI's Windows runners than on a developer machine.
    testTimeout: 30_000,
  },
});
