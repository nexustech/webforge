import { describe, expect, inject, it } from "vitest";

// test-utils declares this too, but depends on the engine: the engine can't depend on it back
// (#539), so it says what it reads itself.
declare module "vitest" {
  export interface ProvidedContext {
    /** How much longer than on CI a test may take in this run (`vitest.load.ts`, ADR 0014). */
    readonly timeoutScale: number;
  }
}

describe("this package's test timeouts (ADR 0014, #531)", () => {
  it("are scaled to the run's workers, never shorter than CI's", () => {
    expect(inject("timeoutScale")).toBeGreaterThanOrEqual(1);
  });
});
