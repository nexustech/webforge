import { describe, expect, it, vi } from "vitest";
import type { WorkerCrash } from "../shared/error-details.js";
import { CRASH_EXIT_DELAY_MS, installWorkerCrashHandlers } from "./crash-handlers.js";

function setUp() {
  const listeners = new Map<string, (error: unknown) => void>();
  const posted: WorkerCrash[] = [];
  const exit = vi.fn();
  const scheduled: [() => void, number][] = [];
  installWorkerCrashHandlers(
    { on: (event, listener) => listeners.set(event, listener) },
    (crash) => posted.push(crash),
    exit,
    (run, ms) => scheduled.push([run, ms]),
  );
  return { listeners, posted, exit, scheduled };
}

describe("installWorkerCrashHandlers (R3)", () => {
  it("tells the main process the error's name and frames, then exits", () => {
    const { listeners, posted, exit, scheduled } = setUp();

    listeners.get("unhandledRejection")?.(new SyntaxError("Rosa's Bakery"));

    expect(posted).toHaveLength(1);
    expect(posted[0]).toMatchObject({
      type: "crashed",
      kind: "unhandled-rejection",
      error: { name: "SyntaxError" },
    });
    expect(JSON.stringify(posted)).not.toContain("Rosa");
    // It exits once the message has had time to go.
    expect(exit).not.toHaveBeenCalled();
    expect(scheduled.map(([, ms]) => ms)).toEqual([CRASH_EXIT_DELAY_MS]);
    scheduled[0]?.[0]();
    expect(exit).toHaveBeenCalledTimes(1);
  });

  it("tells only the first error, and still exits if telling fails", () => {
    const listeners = new Map<string, (error: unknown) => void>();
    const exit = vi.fn();
    installWorkerCrashHandlers(
      { on: (event, listener) => listeners.set(event, listener) },
      () => {
        throw new Error("port closed");
      },
      exit,
      (run) => run(),
    );

    expect(() => listeners.get("uncaughtException")?.(new Error("a"))).toThrow("port closed");
    listeners.get("uncaughtException")?.(new Error("b"));
    expect(exit).toHaveBeenCalledTimes(1);
  });
});
