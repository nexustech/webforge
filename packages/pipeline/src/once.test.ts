import { describe, expect, it, vi } from "vitest";
import { onceUntilFailure } from "./once.js";

describe("onceUntilFailure (R15)", () => {
  it("loads once and shares the result", async () => {
    const load = vi.fn(async () => "codecs");
    const get = onceUntilFailure(load);

    await expect(Promise.all([get(), get()])).resolves.toEqual(["codecs", "codecs"]);
    await expect(get()).resolves.toBe("codecs");
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("forgets a failed load, so the next call tries again", async () => {
    const load = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error("could not compile"))
      .mockResolvedValue("codecs");
    const get = onceUntilFailure(load);

    await expect(get()).rejects.toThrow("could not compile");
    await expect(get()).resolves.toBe("codecs");
    await expect(get()).resolves.toBe("codecs");
    expect(load).toHaveBeenCalledTimes(2);
  });
});
