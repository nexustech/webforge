import { defineProject } from "vitest/config";
import { scaledTimeout, TIMEOUT_SCALE } from "../../vitest.load.js";

export default defineProject({
  test: {
    environment: "happy-dom",
    // Its panels' tests type and tab through React in happy-dom, slower on a busy machine: 15 s, as
    // the renderer's, scaled to the run's workers (ADR 0014).
    testTimeout: scaledTimeout(15_000),
    // For a test that sets its own timeout: `scaledTestTimeout()` reads it.
    provide: { timeoutScale: TIMEOUT_SCALE },
    // Vitest empties CSS files by default; contrast.test.ts reads theme.css as text (?raw).
    css: { include: [/theme\.css/] },
  },
});
