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

/** Each session's latest preview waiting for the next frame, with that frame's request. */
const waiting = new WeakMap<ThemePreviewStore, { theme: ThemeTokens; readonly frame: number }>();

/** Shows the preview waiting for `store`'s next frame now, if one is, rather than then. */
function shownNow(store: ThemePreviewStore): void {
  const next = waiting.get(store);
  if (next === undefined) return;
  cancelAnimationFrame(next.frame);
  waiting.delete(store);
  store.setState({ preview: { theme: next.theme, chosen: false } });
}

/**
 * Shows `theme`, a colour being chosen, in place of the site's (5.30): once a frame at most, the
 * latest colour of a drag (#1316). Each preview restyles the canvas and every sample page, more
 * than a frame's work on a large site, and a pointer can move several times in one.
 */
export function previewTheme(session: { readonly history: object }, theme: ThemeTokens): void {
  const store = themePreviewOf(session);
  const next = waiting.get(store);
  if (next !== undefined) {
    next.theme = theme;
    return;
  }
  const frame = requestAnimationFrame(() => {
    const shown = waiting.get(store);
    if (shown?.frame !== frame) return;
    waiting.delete(store);
    store.setState({ preview: { theme: shown.theme, chosen: false } });
  });
  waiting.set(store, { theme, frame });
}

/**
 * Ends the preview: at once if nothing was `chosen` (Escape: the site's own theme again); else it
 * stays, as the last colour dragged to, until the page's CSS has the change, or
 * {@link CHOSEN_PREVIEW_MS} at most: {@link followThemeChange} ends it sooner when there's none.
 */
export function endThemePreview(session: { readonly history: object }, chosen: boolean): void {
  const store = themePreviewOf(session);
  if (chosen) {
    shownNow(store);
  } else {
    const next = waiting.get(store);
    if (next !== undefined) cancelAnimationFrame(next.frame);
    waiting.delete(store);
  }
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

/**
 * Ends a chosen colour's preview as soon as its `change` turns out not to happen (#1316): declined
 * at a question, or failed. The page shows its own colour again at once rather than the dragged one
 * for {@link CHOSEN_PREVIEW_MS}. A preview still being dragged is left alone. Gives `change`'s
 * outcome, and its failure still fails.
 */
export function followThemeChange(
  session: { readonly history: object },
  change: Promise<boolean>,
): Promise<boolean> {
  const unchosen = () => {
    const store = themePreviewOf(session);
    if (store.getState().preview?.chosen === true) store.setState({ preview: undefined });
  };
  return change.then(
    (changed) => {
      if (!changed) unchosen();
      return changed;
    },
    (error: unknown) => {
      unchosen();
      throw error;
    },
  );
}
