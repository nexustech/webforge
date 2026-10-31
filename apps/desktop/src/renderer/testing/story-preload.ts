import type { WebforgeApi } from "../../shared/webforge-api.js";
import { type PreloadOverrides, preloadApiWith } from "./preload-api.js";

/**
 * The preload API for a story (#668): `fakePreloadApi`'s, without Vitest, which Storybook
 * doesn't load. A call given in `overrides` does what it says; any other does nothing: a
 * subscription returns its unsubscribe, every other call resolves to nothing.
 */
export function storyPreloadApi(overrides: PreloadOverrides = {}): WebforgeApi {
  return preloadApiWith(overrides, (subscription) =>
    subscription ? () => () => undefined : async () => undefined,
  );
}
