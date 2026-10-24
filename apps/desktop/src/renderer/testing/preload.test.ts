import { describe, expect, it, vi } from "vitest";
import { fakePreloadApi } from "./preload.js";

describe("fakePreloadApi (2.20, B6)", () => {
  it("does what the test gives, and stands in for every other call", async () => {
    const listRecent = vi.fn(async () => []);
    const api = fakePreloadApi({ project: { listRecent } });

    await expect(api.project.listRecent()).resolves.toEqual([]);
    expect(listRecent).toHaveBeenCalledOnce();
    // Any other call resolves to nothing, and is a fake the test can check.
    await expect(api.project.removeRecent("a".repeat(32))).resolves.toBeUndefined();
    expect(api.project.removeRecent).toHaveBeenCalledWith("a".repeat(32));
  });

  it("gives a subscription an unsubscribe, and keeps each fake for later checks", () => {
    const api = fakePreloadApi();

    const unsubscribe = api.app.onFlushRequest(async () => undefined);

    expect(unsubscribe).toBeTypeOf("function");
    expect(api.app.onFlushRequest).toBe(api.app.onFlushRequest);
    expect(api.app.onFlushRequest).toHaveBeenCalledOnce();
  });

  it("can be awaited like a plain object, without faking then()", async () => {
    const api = fakePreloadApi();

    await expect(Promise.resolve(api.project)).resolves.toBe(api.project);
    expect("then" in api.project).toBe(false);
  });
});
