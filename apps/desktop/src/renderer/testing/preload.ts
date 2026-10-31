import { vi } from "vitest";
import type { WebforgeApi } from "../../shared/webforge-api.js";
import { type PreloadOverrides, preloadApiWith } from "./preload-api.js";

export type { PreloadOverrides } from "./preload-api.js";

/**
 * The preload API (`window.webforge`) for a renderer test (2.20, B6), without Electron. A call the
 * test gives in `overrides` does what it says; any other is a `vi.fn()`: a subscription (`on…`)
 * returns its unsubscribe, every other call resolves to nothing. Each domain keeps its fakes, so a
 * test can check what was called (`api.project.commit`). Stories use {@link storyPreloadApi}.
 */
export function fakePreloadApi(overrides: PreloadOverrides = {}): WebforgeApi {
  return preloadApiWith(overrides, (subscription) =>
    subscription ? vi.fn(() => () => undefined) : vi.fn(async () => undefined),
  );
}
