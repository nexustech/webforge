import { describe, expect, it, vi } from "vitest";
import { openSiteWith } from "./open-site.js";

const project = { name: "Bakery", fileName: "Bakery.wforge", formatVersion: 1, syncService: null };

describe("openSiteWith", () => {
  it("restarts the window with the site once it is open", async () => {
    const restart = vi.fn();

    await expect(
      openSiteWith(async () => ({ status: "opened", project }), restart),
    ).resolves.toBeUndefined();
    expect(restart).toHaveBeenCalledTimes(1);
  });

  it("does nothing when the user cancels", async () => {
    const restart = vi.fn();

    await expect(
      openSiteWith(async () => ({ status: "canceled" }), restart),
    ).resolves.toBeUndefined();
    expect(restart).not.toHaveBeenCalled();
  });

  it("returns what to tell the user when opening fails or the call itself fails", async () => {
    const restart = vi.fn();

    await expect(
      openSiteWith(async () => ({ status: "failed", reason: "not-a-project" }), restart),
    ).resolves.toBe("This file isn't a Webforge site.");
    await expect(
      openSiteWith(async () => {
        throw new Error("IPC gone");
      }, restart),
    ).resolves.toBe("Webforge couldn't open the site.");
    expect(restart).not.toHaveBeenCalled();
  });
});
