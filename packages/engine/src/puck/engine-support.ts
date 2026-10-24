import type { Data, useGetPuck } from "@puckeditor/core";
import { t } from "@webforge/i18n";
import type { PageDoc } from "@webforge/model";
import type { ReactNode } from "react";
import type { ViewOptions, Viewport } from "../canvas-engine.js";
import { puckPrivateApi } from "./puck-dom.js";

// What the Puck engine's parts share (R8): Puck's API, the device views, the permissions of each
// editing mode, and listeners.

/** Puck's API object, from `useGetPuck`. */
export type PuckApi = ReturnType<ReturnType<typeof useGetPuck>>;

/** How Puck's API is reached: `null` until Puck is ready, and again once it is gone. */
export type PuckHandle = () => PuckApi | null;

/**
 * Asks the focused rich-text editor to send the change Puck still holds back (it sends after a
 * short debounce), through our Puck patch. True if there was one: its edit is then on its way.
 */
export function flushRichText(puck: PuckApi): boolean {
  return puckPrivateApi(puck)?.flushRichText() === true;
}

/** How long Undo or Redo waits at most for a rich-text change it asked Puck to send. */
export const RICH_TEXT_FLUSH_TIMEOUT_MS = 500;

/** The canvas width of each device view. */
export const VIEWPORT_WIDTHS = { desktop: 1280, tablet: 768, mobile: 375 } as const;

/** A canvas width as the app names it: a device view, or a custom width. */
export function viewportOf(width: number): Viewport {
  const named = (Object.keys(VIEWPORT_WIDTHS) as (keyof typeof VIEWPORT_WIDTHS)[]).find(
    (name) => VIEWPORT_WIDTHS[name] === width,
  );
  return named ?? width;
}

/** The device views Puck's canvas controls offer: Desktop · Tablet · Mobile (until 1.15). */
export const puckViewports = () => [
  { width: VIEWPORT_WIDTHS.mobile, label: t("device.mobile"), icon: "Smartphone" as const },
  { width: VIEWPORT_WIDTHS.tablet, label: t("device.tablet"), icon: "Tablet" as const },
  { width: VIEWPORT_WIDTHS.desktop, label: t("device.desktop"), icon: "Monitor" as const },
];

/** Content mode: text stays editable, the layout is locked (M3). */
export const CONTENT_MODE_PERMISSIONS = {
  drag: false,
  duplicate: false,
  delete: false,
  insert: false,
};

/**
 * Design mode: everything. Always passed, never left out: Puck merges the permissions it is given
 * into those it has, so leaving them out after Content mode would keep the layout locked.
 */
export const DESIGN_MODE_PERMISSIONS = { drag: true, duplicate: true, delete: true, insert: true };

/** The View options before the app sets any: nothing shown besides the page. */
export const NO_VIEW_OPTIONS: ViewOptions = {
  outlines: false,
  spacingOnHover: false,
  elementNames: false,
  extraBottomSpace: false,
};

/** A page with nothing on it. */
export const EMPTY_PAGE: PageDoc = { root: { props: {} }, content: [] };

/** `page` as Puck's data. */
export function toPuckData(page: PageDoc): Data {
  // PageDoc is the same tree as Puck's Data (see toPageDoc); only the TypeScript types differ.
  return page as unknown as Data;
}

/** Listeners to one kind of event. */
export type Emitter<T> = { add(listener: (value: T) => void): () => void; emit(value: T): void };

/** A new {@link Emitter}, with no listeners. */
export function emitter<T>(): Emitter<T> {
  const listeners = new Set<(value: T) => void>();
  return {
    add(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    emit(value) {
      for (const listener of listeners) listener(value);
    },
  };
}

/** The canvas without an error boundary: see `MountOptions.errorBoundary`. */
export function NoBoundary({ children }: { readonly children: ReactNode }) {
  return children;
}

/** The page, layout and shared sections the canvas shows, as `memoByDocs` compares them. */
type Docs = {
  readonly page: unknown;
  readonly layout: unknown;
  readonly shared: unknown;
};

/**
 * `make`, made again only when the page, layout or shared sections it was made for change (by
 * reference): what the canvas works out from them once per change rather than per drawing.
 */
export function memoByDocs<D extends Docs, T>(make: (docs: D) => T): (docs: D) => T {
  let made: { readonly docs: D; readonly value: T } | null = null;
  return (docs) => {
    if (
      made === null ||
      made.docs.page !== docs.page ||
      made.docs.layout !== docs.layout ||
      made.docs.shared !== docs.shared
    ) {
      made = { docs, value: make(docs) };
    }
    return made.value;
  };
}
