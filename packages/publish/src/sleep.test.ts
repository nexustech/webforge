import { afterEach, describe, expect, it, vi } from "vitest";
import { PublishError } from "./publisher.js";
import { sleep } from "./sleep.js";

afterEach(() => {
  vi.useRealTimers();
});

describe("sleep (#671)", () => {
  it("waits as long as it's asked", async () => {
    vi.useFakeTimers();
    let done = false;
    const waiting = sleep(1_000, undefined).then(() => {
      done = true;
    });

    await vi.advanceTimersByTimeAsync(999);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await waiting;
    expect(done).toBe(true);
  });

  it("ends at once as cancelled when its signal aborts, and when it already has", async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const waiting = sleep(60_000, controller.signal);
    controller.abort();

    await expect(waiting).rejects.toMatchObject({ code: "cancelled" });
    await expect(sleep(60_000, controller.signal)).rejects.toBeInstanceOf(PublishError);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("stops listening to its signal once it has waited", async () => {
    const controller = new AbortController();
    const remove = vi.spyOn(controller.signal, "removeEventListener");

    await sleep(1, controller.signal);

    expect(remove).toHaveBeenCalledWith("abort", expect.any(Function));
  });
});
