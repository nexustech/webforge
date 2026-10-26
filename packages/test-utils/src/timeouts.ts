import { inject } from "vitest";

declare module "vitest" {
  export interface ProvidedContext {
    /** How much longer than on CI a test may take in this run (`vitest.load.ts`, ADR 0014). */
    readonly timeoutScale: number;
  }
}

/**
 * A test's own timeout, set for CI's runners, scaled to the run's workers (ADR 0014): for a test
 * that sets one longer than its package's default. Without a scale provided, as set.
 */
export function scaledTestTimeout(ms: number): number {
  return Math.round(ms * (inject("timeoutScale") ?? 1));
}
