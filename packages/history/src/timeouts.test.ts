import { scaledTestTimeout } from "@webforge/test-utils/vitest";
import { describe, expect, it } from "vitest";

describe("this package's test timeouts (ADR 0014, #531)", () => {
  it("are scaled to the run's workers, never shorter than CI's", () => {
    // It throws when the package's vitest.config.ts provides no scale.
    expect(scaledTestTimeout(1_000)).toBeGreaterThanOrEqual(1_000);
  });
});
