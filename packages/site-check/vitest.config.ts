import { defineProject } from "vitest/config";
import { scaledTimeout, TIMEOUT_SCALE } from "../../vitest.load.js";

export default defineProject({
  test: {
    // Its rules run over whole sites, and the cost test over five large pages many times: CPU-bound
    // work, slower when the run's other workers share the machine (#555). Vitest's defaults (5 s,
    // hooks 10 s), scaled to the run's workers (ADR 0014); the cost test's budget is CPU time, which
    // load doesn't change.
    testTimeout: scaledTimeout(5_000),
    hookTimeout: scaledTimeout(10_000),
    // For a test that sets its own timeout: `scaledTestTimeout()` reads it.
    provide: { timeoutScale: TIMEOUT_SCALE },
  },
});
