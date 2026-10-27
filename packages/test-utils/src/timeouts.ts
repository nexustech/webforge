import { inject } from "vitest";

declare module "vitest" {
  export interface ProvidedContext {
    /** How much longer than on CI a test may take in this run (`vitest.load.ts`, ADR 0014). */
    readonly timeoutScale: number;
  }
}

/**
 * A test's own timeout, set for CI's runners, scaled to the run's workers (ADR 0014): for a test
 * that sets one longer than its package's default. Its package's `vitest.config.ts` provides the
 * scale; a package that doesn't can't use this, and is told so rather than given CI's timeout.
 */
export function scaledTestTimeout(ms: number): number {
  const scale = inject("timeoutScale") as number | undefined;
  if (scale === undefined) {
    throw new Error(
      "No timeoutScale provided: add `provide: { timeoutScale }` to this package's vitest.config.ts (ADR 0014)",
    );
  }
  return Math.round(ms * scale);
}
