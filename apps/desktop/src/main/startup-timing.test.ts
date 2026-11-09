import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type LogLevel, setLogSink } from "./log.js";
import { logStartupTimes, markStartup, startupTimes } from "./startup-timing.js";

const lines: [LogLevel, string][] = [];

beforeEach(() => {
  performance.clearMarks();
  setLogSink((level, line) => {
    lines.push([level, line]);
  });
});

afterEach(() => {
  lines.length = 0;
  setLogSink();
  performance.clearMarks();
});

describe("start-up timing (#891)", () => {
  it("gives the process's start and each stage marked, in order, leaving other marks out", () => {
    markStartup("main-entry");
    performance.mark("someone-else");
    markStartup("ready");

    const times = startupTimes();

    expect(Object.keys(times)).toEqual(["origin", "main-entry", "ready"]);
    expect(times.origin).toBeCloseTo(performance.timeOrigin, 0);
    expect(times["main-entry"]).toBeLessThanOrEqual(times.ready ?? 0);
    expect(times.ready).toBeLessThanOrEqual(performance.now());
  });

  it("logs the stages by name and time in a perf build only", () => {
    markStartup("window-created");

    logStartupTimes("production");
    expect(lines).toEqual([]);

    logStartupTimes("perf");
    expect(lines).toEqual([
      [
        "info",
        expect.stringMatching(
          /^Webforge start-up \(origin=\d+(\.\d)?, window-created=\d+(\.\d)?\)$/,
        ),
      ],
    ]);
  });
});
