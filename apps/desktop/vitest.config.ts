import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    // The renderer's tests drive React panels and dialogs in happy-dom: CPU-bound work, not
    // waiting. When other checks or E2E share the machine, a few took past the 5 s default.
    testTimeout: 15_000,
  },
});
