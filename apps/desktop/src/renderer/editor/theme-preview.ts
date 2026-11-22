import type { ThemeTokens } from "@webforge/model";
import { createStore, type StoreApi } from "zustand/vanilla";

/**
 * A theme being chosen in a colour picker, before it is a change (5.30, OL-18): the canvas and
 * Theme Studio's previews show it at once, over their compiled CSS, with no compile. `chosen` once
 * the picker closed on it: the change is being made, and the page shows the preview until its own
 * CSS has the change, so it never flicks back to the colour it had.
 */
export type ThemePreview = { readonly theme: ThemeTokens; readonly chosen: boolean } | undefined;

/** The preview's store: one per session, shared by what chooses colours and what shows them. */
export type ThemePreviewStore = StoreApi<{ readonly preview: ThemePreview }>;

/**
 * How long a chosen preview may wait for the change to show before it ends anyway (a change that
 * didn't happen, such as one declined): long enough for a large site's compile.
 */
export const CHOSEN_PREVIEW_MS = 5_000;

/** Each session's store, made when first asked for. */
const stores = new WeakMap<object, ThemePreviewStore>();

/** The theme preview of `session` (by its history, which a session has one of). */
export function themePreviewOf(session: { readonly history: object }): ThemePreviewStore {
  let store = stores.get(session.history);
  if (store === undefined) {
    store = createStore(() => ({ preview: undefined as ThemePreview }));
    stores.set(session.history, store);
  }
  return store;
}

/** Shows `theme`, a colour being chosen, in place of the site's (5.30). */
export function previewTheme(session: { readonly history: object }, theme: ThemeTokens): void {
  themePreviewOf(session).setState({ preview: { theme, chosen: false } });
}

/**
 * Ends the preview: at once if nothing was `chosen` (Escape: the site's own theme again); else it
 * stays until the page's CSS has the change, or {@link CHOSEN_PREVIEW_MS} at most.
 */
export function endThemePreview(session: { readonly history: object }, chosen: boolean): void {
  const store = themePreviewOf(session);
  const current = store.getState().preview;
  if (!chosen || current === undefined) {
    store.setState({ preview: undefined });
    return;
  }
  const ended = { theme: current.theme, chosen: true };
  store.setState({ preview: ended });
  setTimeout(() => {
    if (store.getState().preview === ended) store.setState({ preview: undefined });
  }, CHOSEN_PREVIEW_MS);
}
