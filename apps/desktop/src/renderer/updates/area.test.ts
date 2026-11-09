import { toast } from "@webforge/editor-ui";
import { describe, expect, it, vi } from "vitest";
import type { UpdateStatus } from "../../shared/ipc/updates.js";
import { WINDOW_AREAS } from "../areas.js";
import type { WindowContext } from "../editor/areas.js";
import { fakePreloadApi } from "../testing/preload.js";
import { updatesArea } from "./area.js";
import { updateReadyNotices, watchUpdates } from "./update-ready.js";

vi.mock("@webforge/editor-ui", async (original) => {
  const actual = await original<typeof import("@webforge/editor-ui")>();
  return { ...actual, toast: Object.assign(vi.fn(), actual.toast, { info: vi.fn() }) };
});

/** An `updates` API whose pushes the test makes, and whose state main already has. */
function fakeUpdates(now: UpdateStatus) {
  let listener: ((status: UpdateStatus) => void) | undefined;
  const stop = vi.fn();
  return {
    stop,
    push: (status: UpdateStatus) => listener?.(status),
    updates: {
      status: async () => now,
      onStatus: (given: (status: UpdateStatus) => void) => {
        listener = given;
        return stop;
      },
    },
  };
}

describe("the Updates area (0.5a)", () => {
  it("is listed in the composition root", () => {
    expect(WINDOW_AREAS).toContain(updatesArea);
  });

  it("shows the notice, worded with the version, until it's removed", async () => {
    const { updates, stop } = fakeUpdates({ state: "downloaded", version: "1.2.0" });
    const remove = updatesArea.register({
      api: fakePreloadApi({ updates }),
    } as unknown as WindowContext);

    await vi.waitFor(() =>
      expect(toast.info).toHaveBeenCalledWith(
        "Webforge 1.2.0 is ready: it installs when you close Webforge.",
        { id: "update-ready", duration: 10_000 },
      ),
    );
    remove();
    expect(stop).toHaveBeenCalled();
  });
});

describe("watchUpdates", () => {
  it("tells of an update main already has, then of each it downloads", async () => {
    const show = vi.fn();
    const fake = fakeUpdates({ state: "downloaded", version: "1.2.0" });
    watchUpdates(fake.updates, show);
    await vi.waitFor(() => expect(show).toHaveBeenCalledWith("1.2.0"));
    fake.push({ state: "downloaded", version: "1.2.0" });
    fake.push({ state: "downloaded", version: "1.3.0" });
    expect(show.mock.calls).toEqual([["1.2.0"], ["1.3.0"]]);
  });

  it("shows nothing when main can't say", async () => {
    const show = vi.fn();
    const status = vi.fn(async (): Promise<UpdateStatus> => {
      throw new Error("gone");
    });
    watchUpdates({ status, onStatus: () => () => undefined }, show);
    await vi.waitFor(() => expect(status).toHaveBeenCalled());
    await Promise.resolve();
    expect(show).not.toHaveBeenCalled();
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
