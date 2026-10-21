import { describe, expect, it, vi } from "vitest";
import type { ProjectResult } from "../shared/ipc-contract.js";
import { createHandOff, type HandOffOptions } from "./hand-off.js";

const project = {
  name: "Florist",
  fileName: "Florist.wforge",
  formatVersion: 1,
  syncService: null,
};
const opened: ProjectResult = { status: "opened", project };

function setup(overrides: Partial<HandOffOptions> = {}) {
  const calls: string[] = [];
  const options = {
    currentPath: vi.fn((): string | undefined => "/sites/Bakery.wforge"),
    leaveSite: vi.fn(async () => {
      calls.push("leave");
    }),
    open: vi.fn(async (path: string) => {
      calls.push(`open ${path}`);
      return opened;
    }),
    focus: vi.fn(() => {
      calls.push("focus");
    }),
    show: vi.fn((reload: boolean) => {
      calls.push(reload ? "reload" : "show");
    }),
    failed: vi.fn(async (reason: string) => {
      calls.push(`failed ${reason}`);
    }),
    ...overrides,
  };
  return { handOff: createHandOff(options), options, calls };
}

describe("createHandOff", () => {
  it("focuses the window, saves the open site, then opens the new one in its place", async () => {
    const { handOff, calls } = setup();

    await handOff.open("/sites/Florist.wforge");

    expect(calls).toEqual(["focus", "leave", "open /sites/Florist.wforge", "reload"]);
  });

  it("only shows the window for a launch without a site, or for the site already open", async () => {
    const { handOff, calls } = setup();

    await handOff.open(undefined);
    await handOff.open("/sites/Bakery.wforge");

    expect(calls).toEqual(["show", "show"]);
  });

  it("opens a site when none is open", async () => {
    const { handOff, calls } = setup({ currentPath: () => undefined });

    await handOff.open("/sites/Florist.wforge");

    expect(calls).toEqual(["focus", "leave", "open /sites/Florist.wforge", "reload"]);
  });

  it("says why a site didn't open and keeps the window as it is", async () => {
    const { handOff, calls } = setup({
      open: async () => ({ status: "failed", reason: "newer-format" }),
    });

    await handOff.open("/sites/Florist.wforge");

    expect(calls).toEqual(["focus", "leave", "failed newer-format"]);
  });

  it("does nothing more when the user cancels the recovery of a damaged site", async () => {
    const { handOff, calls } = setup({ open: async () => ({ status: "canceled" }) });

    await handOff.open("/sites/Florist.wforge");

    expect(calls).toEqual(["focus", "leave"]);
  });

  it("runs hand-offs one at a time, and a failed one doesn't block the next", async () => {
    let release: () => void = () => undefined;
    const saved = new Promise<void>((resolve) => {
      release = resolve;
    });
    const leaveSite = vi
      .fn<() => Promise<void>>()
      .mockImplementationOnce(() => saved.then(() => Promise.reject(new Error("no window"))))
      .mockResolvedValue(undefined);
    const { handOff, options } = setup({ leaveSite });

    const first = handOff.open("/sites/One.wforge");
    const second = handOff.open("/sites/Two.wforge");
    await Promise.resolve();
    expect(leaveSite).toHaveBeenCalledTimes(1);
    release();
    await Promise.all([first, second]);

    expect(options.open).toHaveBeenCalledTimes(1);
    expect(options.open).toHaveBeenCalledWith("/sites/Two.wforge");
  });
});
