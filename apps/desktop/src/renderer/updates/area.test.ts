import { describe, expect, it, vi } from "vitest";
import type { UpdateStatus } from "../../shared/ipc/updates.js";
import { WINDOW_AREAS } from "../areas.js";
import type { WindowContext } from "../editor/areas.js";
import { fakePreloadApi } from "../testing/preload.js";
import { updatesArea } from "./area.js";
import { showUpdateReady, updateReadyNotices } from "./update-ready.js";

vi.mock("./update-ready.js", async (original) => ({
  ...(await original<typeof import("./update-ready.js")>()),
  showUpdateReady: vi.fn(),
}));

describe("the Updates area (0.5a)", () => {
  it("is listed in the composition root", () => {
    expect(WINDOW_AREAS).toContain(updatesArea);
  });

  it("tells of an update main already has as the window opens, then of each it downloads", async () => {
    let listener: ((status: UpdateStatus) => void) | undefined;
    const stop = vi.fn();
    const api = fakePreloadApi({
      updates: {
        status: async () => ({ state: "downloaded", version: "1.2.0" }),
        onStatus: (given) => {
          listener = given;
          return stop;
        },
      },
    });

    const remove = updatesArea.register({ api } as unknown as WindowContext);
    await vi.waitFor(() => expect(showUpdateReady).toHaveBeenCalledWith("1.2.0"));
    listener?.({ state: "downloaded", version: "1.2.0" });
    listener?.({ state: "downloaded", version: "1.3.0" });
    expect(vi.mocked(showUpdateReady).mock.calls).toEqual([["1.2.0"], ["1.3.0"]]);

    remove();
    expect(stop).toHaveBeenCalled();
  });
});

describe("updateReadyNotices", () => {
  it("tells of an update once it has downloaded, once per version", () => {
    const show = vi.fn();
    const notice = updateReadyNotices(show);
    const statuses: UpdateStatus[] = [
      { state: "idle" },
      { state: "available", version: "1.2.0" },
      { state: "error" },
      { state: "downloaded", version: "1.2.0" },
      { state: "downloaded", version: "1.2.0" },
      { state: "downloaded", version: "1.3.0" },
    ];
    for (const status of statuses) notice(status);
    expect(show.mock.calls).toEqual([["1.2.0"], ["1.3.0"]]);
  });
});
