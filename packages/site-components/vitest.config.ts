import { defineProject } from "vitest/config";
import { scaledTimeout, TIMEOUT_SCALE } from "../../vitest.load.js";

export default defineProject({
  test: {
    // The Storybook stylesheets' sources, read as text by storybook-css.test.ts; Vitest empties CSS
    // otherwise.
    css: { include: [/\.storybook\/sources\.css/] },
    // Its tests render every component and check its classes with fast-check, hundreds of runs at
    // a time: storybook-css.test.ts ran out of Vitest's 5 s in a full `pnpm check` (#1147). Vitest's
    // defaults (5 s, hooks 10 s), scaled to the run's workers (ADR 0014).
    testTimeout: scaledTimeout(5_000),
    hookTimeout: scaledTimeout(10_000),
    // For a test that sets its own timeout: `scaledTestTimeout()` reads it.
    provide: { timeoutScale: TIMEOUT_SCALE },
  },
});
