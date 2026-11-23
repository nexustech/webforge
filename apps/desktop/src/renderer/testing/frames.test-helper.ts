import { vi } from "vitest";

/**
 * Animation frames that come when a test says (`run`), in place of the environment's (Node has
 * none): what's waiting for the next frame, and that frame. Undone by `vi.unstubAllGlobals()`.
 */
export function stubFrames(): { readonly run: () => void; readonly waiting: () => number } {
  let next = new Map<number, FrameRequestCallback>();
  let id = 0;
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    id += 1;
    next.set(id, callback);
    return id;
  });
  vi.stubGlobal("cancelAnimationFrame", (frame: number) => {
    next.delete(frame);
  });
  return {
    run: () => {
      const due = next;
      next = new Map();
      for (const callback of due.values()) callback(performance.now());
    },
    waiting: () => next.size,
  };
}
