import { describe, expect, it, vi } from "vitest";
import { announceClosedForE2eTests, E2E_CLOSED_LINE, E2E_CLOSED_VARIABLE } from "./e2e-closed.js";

describe("announceClosedForE2eTests (#534)", () => {
  it("says it has closed when the E2E tests launched it", () => {
    const write = vi.fn();
    announceClosedForE2eTests(false, { [E2E_CLOSED_VARIABLE]: "1" }, write);
    expect(write).toHaveBeenCalledWith(`${E2E_CLOSED_LINE}\n`);
  });

  it("says nothing in the installed app, nor without the variable", () => {
    const write = vi.fn();
    announceClosedForE2eTests(true, { [E2E_CLOSED_VARIABLE]: "1" }, write);
    announceClosedForE2eTests(false, {}, write);
    announceClosedForE2eTests(false, { [E2E_CLOSED_VARIABLE]: "0" }, write);
    expect(write).not.toHaveBeenCalled();
  });
});
