import { createStore, type StoreApi } from "zustand/vanilla";

/** Theme Studio's sections, in its list (F-DS-7). */
export const STUDIO_SECTIONS = ["themes", "colors", "text", "styles"] as const;

/** One of {@link STUDIO_SECTIONS}. */
export type StudioSection = (typeof STUDIO_SECTIONS)[number];

/** Whether Theme Studio is open, and the section it shows. */
export type StudioState = { readonly open: boolean; readonly section: StudioSection };

/**
 * Theme Studio's state, made once for the window: the Theme tab's button and View → Theme Studio…
 * open it, and the tab draws it, so it stays as it was while the tab is hidden and shown again.
 */
export function createStudio(): StoreApi<StudioState> {
  return createStore<StudioState>()(() => ({ open: false, section: "themes" }));
}
