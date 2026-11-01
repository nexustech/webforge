import { createSite, type SiteDoc } from "@webforge/model";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { setFailureLog } from "../log.js";
import { gateOnSiteCheck, runWithProgress } from "./build-flow.js";

const toast = vi.hoisted(() => ({
  loading: vi.fn((_title: string, _options?: object) => "progress"),
  error: vi.fn(),
}));
vi.mock("@webforge/editor-ui", () => ({ toast }));

beforeEach(() => vi.clearAllMocks());

const bakery = (): SiteDoc =>
  createSite({ name: "Bakery", language: "en", homeTitle: "Home", notFoundTitle: "Not found" });

describe("gateOnSiteCheck (#668)", () => {
  it("lets a site through in a mode where nothing is Must fix, and stops it in a stricter one", () => {
    const showSiteCheck = vi.fn();
    const gate = { blocked: (count: number) => `Fix ${count}`, showSiteCheck };

    // A new site has no web address: fine to export, a Must fix to publish (X5, ADR 0016).
    expect(gateOnSiteCheck(bakery(), "export", gate)).toBe(true);
    expect(toast.error).not.toHaveBeenCalled();
    expect(showSiteCheck).not.toHaveBeenCalled();

    expect(gateOnSiteCheck(bakery(), "publish", gate)).toBe(false);
    expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/^Fix [1-9]\d*$/));
    expect(showSiteCheck).toHaveBeenCalledOnce();
  });
});

/** The work's own controls: its stages told as they come, and when it answers. */
function work<Result>() {
  let report: ((stage: string) => void) | undefined;
  let answer: ((result: Result) => void) | undefined;
  let fail: ((error: unknown) => void) | undefined;
  const run = vi.fn(
    (onProgress: (stage: string) => void) =>
      new Promise<Result>((resolve, reject) => {
        report = onProgress;
        answer = resolve;
        fail = reject;
      }),
  );
  return {
    run,
    stage: (stage: string) => report?.(stage),
    answer: (result: Result) => answer?.(result),
    fail: (error: unknown) => fail?.(error),
  };
}

const options = <Result>(running: ReturnType<typeof work<Result>>, failed: Result) => ({
  working: "Working…",
  describe: (stage: string) => `At ${stage}`,
  cancelLabel: "Cancel",
  cancelling: "Stopping…",
  cancel: vi.fn(async () => null),
  run: running.run,
  failed,
  failureKey: "build",
});

describe("runWithProgress (#668)", () => {
  it("shows each stage in one toast, and gives back the outcome with the toast's id", async () => {
    const running = work<string>();
    const outcome = runWithProgress(options(running, "failed"));

    running.stage("images");
    running.answer("done");

    await expect(outcome).resolves.toEqual({ result: "done", progress: "progress" });
    expect(toast.loading).toHaveBeenNthCalledWith(1, "Working…", { action: expect.anything() });
    expect(toast.loading).toHaveBeenNthCalledWith(2, "Working…", {
      id: "progress",
      description: "At images",
      action: expect.anything(),
    });
  });

  it("says it's stopping once cancelled, and later stages leave the toast be", async () => {
    const running = work<string>();
    const given = options(running, "failed");
    const outcome = runWithProgress(given);
    const [, first] = toast.loading.mock.calls[0] ?? [];
    const button = (first as { action: { onClick(event: { preventDefault(): void }): void } })
      .action;
    const preventDefault = vi.fn();

    button.onClick({ preventDefault });
    running.stage("pages");
    running.answer("cancelled");

    await expect(outcome).resolves.toMatchObject({ result: "cancelled" });
    expect(preventDefault).toHaveBeenCalledOnce();
    expect(given.cancel).toHaveBeenCalledOnce();
    expect(toast.loading).toHaveBeenLastCalledWith("Stopping…", {
      id: "progress",
      description: null,
      action: null,
    });
  });

  it("gives the failed outcome when the work throws, logged by its code only", async () => {
    const logged = vi.fn(async () => undefined);
    setFailureLog(logged);
    const running = work<string>();
    const outcome = runWithProgress(options(running, "failed"));

    running.fail(Object.assign(new Error("C:\\Users\\rosa\\site"), { code: "EIO" }));

    await expect(outcome).resolves.toMatchObject({ result: "failed" });
    expect(logged).toHaveBeenCalledWith("build", "Error EIO");
    setFailureLog(undefined);
  });
});
