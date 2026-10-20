import { describe, expect, it, vi } from "vitest";
import type { ProjectFailureReason } from "../../shared/ipc-contract.js";
import { openFailureMessage, openSiteWith } from "./open-site.js";

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

describe("openFailureMessage", () => {
  it.each<[ProjectFailureReason, string]>([
    ["not-a-project", "This file isn't a Webforge site."],
    ["corrupt", "This site file is damaged and can't be opened."],
    ["unexpected-schema", "This site file is damaged and can't be opened."],
    [
      "newer-format",
      "This site was saved by a newer version of Webforge. Update Webforge to open it.",
    ],
    ["not-found", "The site file is no longer there. It may have been moved or deleted."],
    ["unknown", "Webforge couldn't open the site."],
  ])("explains %s", (reason, message) => {
    expect(openFailureMessage(reason)).toBe(message);
  });
});
