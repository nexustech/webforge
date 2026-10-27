import { defineProject } from "vitest/config";
import { scaledTimeout, TIMEOUT_SCALE } from "../../vitest.load.js";

export default defineProject({
  test: {
    // The renderer's tests drive React panels and dialogs in happy-dom: CPU-bound work, not
    // waiting. When other checks or E2E share the machine, a few took past the 5 s default. Scaled
    // to the run's workers (ADR 0014); a test that sets its own scales it with `timeoutScale`.
    testTimeout: scaledTimeout(15_000),
    provide: { timeoutScale: TIMEOUT_SCALE },
  },
});
