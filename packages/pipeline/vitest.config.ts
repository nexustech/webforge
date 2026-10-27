import { defineProject } from "vitest/config";
import { scaledTimeout, TIMEOUT_SCALE } from "../../vitest.load.js";

export default defineProject({
  test: {
    // Its tests compile the site CSS with Tailwind and render whole sites: CPU-bound work, slower
    // when the run's other workers share the machine. Vitest's defaults (5 s, hooks 10 s), scaled to
    // the run's workers (ADR 0014).
    testTimeout: scaledTimeout(5_000),
    hookTimeout: scaledTimeout(10_000),
    // For a test that sets its own timeout: `scaledTestTimeout()` reads it.
    provide: { timeoutScale: TIMEOUT_SCALE },
  },
});
