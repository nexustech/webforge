import { configDefaults, defineProject } from "vitest/config";
import { scaledTimeout, TIMEOUT_SCALE } from "../../vitest.load.js";

/**
 * The cost test (`check-cost.test.ts`, ADR 0016) times the rules against a copy of the site through
 * JSON. Coverage counts every block of the rules' JavaScript as it runs, but not the native JSON
 * copy, so under coverage the rules read as up to twice as costly (#698): it runs in
 * `pnpm test:compiled`, without coverage (`vitest.compiled.config.ts`), not in `pnpm test`.
 */
export const COST_TEST = "src/check-cost.test.ts";

export default defineProject({
  test: {
    exclude: [...configDefaults.exclude, COST_TEST],
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
