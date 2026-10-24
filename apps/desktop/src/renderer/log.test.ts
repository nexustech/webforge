import { afterEach, describe, expect, it, vi } from "vitest";
import { reportFailure, setFailureLog, showInDevConsole } from "./log.js";

afterEach(() => {
  setFailureLog(undefined);
  vi.restoreAllMocks();
});

describe("reportFailure (R12)", () => {
  it("sends where a failure happened and the error's name and code, never its message", () => {
    const log = vi.fn(async () => null);
    setFailureLog(log);

    reportFailure("clipboard.paste", new TypeError("Cannot read '/home/ana/Bakery.wforge'"));
    reportFailure("media.import", Object.assign(new Error("x"), { code: "ENOSPC" }));

    expect(log.mock.calls).toEqual([
      ["clipboard.paste", "TypeError"],
      ["media.import", "Error ENOSPC"],
    ]);
  });

  it("never fails the caller, and does nothing without a log", async () => {
    setFailureLog(() => Promise.reject(new Error("ipc-failed")));
    expect(() => reportFailure("export", new Error("x"))).not.toThrow();
    await Promise.resolve();

    setFailureLog(undefined);
    expect(() => reportFailure("export", new Error("x"))).not.toThrow();
  });

  it("shows an error in the developer console", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const thrown = new Error("boom");

    showInDevConsole(thrown);

    expect(error).toHaveBeenCalledWith(thrown);
  });
});
