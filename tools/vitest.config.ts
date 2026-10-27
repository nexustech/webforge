import { configDefaults, defineProject } from "vitest/config";
import { scaledTimeout } from "../vitest.load.js";

export default defineProject({
  test: {
    // The UI-string guard's fixtures include a *.test.tsx that the guard must skip; it is data.
    exclude: [...configDefaults.exclude, "test/fixtures/**"],
    // Vitest's defaults, scaled to the run's workers (ADR 0014): its checks run the compilers.
    testTimeout: scaledTimeout(5_000),
    hookTimeout: scaledTimeout(10_000),
  },
});
