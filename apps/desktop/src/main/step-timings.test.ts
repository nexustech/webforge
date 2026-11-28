import { afterEach, describe, expect, it, vi } from "vitest";

// The opening's step times (#1560): recorded only when the E2E launch asks, durations under fixed
// names only, read from main by the tests.

/** The module as main loads it with `WEBFORGE_STEP_TIMINGS` set to `value`, or unset. */
async function loaded(value?: string) {
  vi.resetModules();
  if (value === undefined) vi.stubEnv("WEBFORGE_STEP_TIMINGS", undefined as unknown as string);
  else vi.stubEnv("WEBFORGE_STEP_TIMINGS", value);
  return import("./step-timings.js");
}

afterEach(() => {
  vi.unstubAllEnvs();
  delete (globalThis as { webforgeStepTimings?: unknown }).webforgeStepTimings;
});

describe("the opening's step times (#1560)", () => {
  it("records nothing, and offers nothing to read, unless the launch asks", async () => {
    for (const value of [undefined, "", "0", "true"]) {
      const timings = await loaded(value);

      expect(timings.timeStep("save the site", () => 7)).toBe(7);
      await expect(timings.timeStepLater("open the session", async () => 8)).resolves.toBe(8);
      timings.markStep("a frame finished loading");

      expect(timings.recordedSteps()).toEqual([]);
      expect("webforgeStepTimings" in globalThis).toBe(false);
      // No write timer for the store: a write times nothing in the packaged app (#1621).
      expect(timings.writeTimer).toBeUndefined();
    }
  });

  it("records each step's duration in order once asked, ending a step that throws", async () => {
    const timings = await loaded("1");

    timings.timeStep("make the file", () => undefined);
    await timings.timeStepLater("image 1 of 2", async () => undefined);
    expect(() =>
      timings.timeStep("first commit", () => {
        throw new Error("disk full");
      }),
    ).toThrow("disk full");
    await expect(
      timings.timeStepLater("open the session", () => Promise.reject(new Error("no"))),
    ).rejects.toThrow("no");
    timings.markStep("a frame finished loading");

    const steps = timings.recordedSteps();
    expect(steps.map((each) => each.step)).toEqual([
      "make the file",
      "image 1 of 2",
      "first commit",
      "open the session",
      "a frame finished loading",
    ]);
    for (const each of steps) {
      expect(each.ms).toBeGreaterThanOrEqual(0);
      expect(each.at).toBeGreaterThan(0);
      // Durations under fixed names only: nothing else in an entry.
      expect(Object.keys(each).sort()).toEqual(["at", "ms", "step"]);
    }
    // The tests read them from main.
    expect((globalThis as { webforgeStepTimings?: () => unknown }).webforgeStepTimings?.()).toEqual(
      steps,
    );
  });

  it("records each committed write's changes and flush, to a tenth of a ms, once asked (#1621)", async () => {
    const timings = await loaded("1");

    timings.writeTimer?.({ changesMs: 2.04, flushMs: 16.36 });

    expect(timings.recordedSteps()).toMatchObject([
      { step: "a write's changes", ms: 2 },
      { step: "a write's flush", ms: 16.4 },
    ]);
  });

  it("keeps only the latest 500 steps", async () => {
    const timings = await loaded("1");

    for (let index = 0; index < 600; index++) timings.markStep("a frame finished loading");

    expect(timings.recordedSteps()).toHaveLength(500);
  });
});
