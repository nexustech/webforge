import { describe, expect, it, vi } from "vitest";
import type { ListVersionsResult } from "../../shared/ipc/versions.js";
import { createVersionList } from "./version-list.js";

vi.mock("../log.js", () => ({ reportFailure: vi.fn() }));

const ok = (bytes: number): ListVersionsResult => ({ status: "ok", versions: [], bytes });

describe("the open site's versions, as the panel shows them (4.6)", () => {
  it("is loading until main lists them, then shows them", async () => {
    const list = createVersionList(async () => ok(10));
    expect(list.state.getState()).toEqual({ status: "loading" });

    await list.refresh();

    expect(list.state.getState()).toEqual({ status: "ready", versions: [], bytes: 10 });
  });

  it("shows the newest listing, never one that comes back after it", async () => {
    let answerFirst: (result: ListVersionsResult) => void = () => undefined;
    const answers = [
      new Promise<ListVersionsResult>((resolve) => {
        answerFirst = resolve;
      }),
      Promise.resolve(ok(2)),
    ];
    const list = createVersionList(() => answers.shift() ?? Promise.resolve(ok(0)));

    const first = list.refresh();
    await list.refresh();
    answerFirst(ok(1));
    await first;

    expect(list.state.getState()).toMatchObject({ bytes: 2 });
  });

  it("says it failed when main can't list them, or the call fails", async () => {
    const refused = createVersionList(async () => ({ status: "failed", reason: "unknown" }));
    await refused.refresh();
    expect(refused.state.getState()).toEqual({ status: "failed" });

    const thrown = createVersionList(() => Promise.reject(new Error("gone")));
    await thrown.refresh();
    expect(thrown.state.getState()).toEqual({ status: "failed" });
  });
});
