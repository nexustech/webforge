import { createStore, type StoreApi } from "zustand/vanilla";

/** Theme Studio's sections, in its list (F-DS-7); Components shows each kind's look (3.12). */
export const STUDIO_SECTIONS = ["themes", "colors", "text", "styles", "components"] as const;

/** One of {@link STUDIO_SECTIONS}. */
export type StudioSection = (typeof STUDIO_SECTIONS)[number];

/**
 * Components' changes to one kind's look not applied yet (4.10): the kind, its name for the step's
 * label ("Button"), and only the fields it changes, each to its value or `undefined` to take it
 * off, so the look's other fields stay as they are when it is applied.
 */
export type LookDraft = {
  readonly type: string;
  readonly item: string;
  readonly change: Readonly<Record<string, unknown>>;
};

/** What waits on the answer to apply or discard a draft: closing, or another kind (4.10). */
export type DraftPending = { readonly close: true } | { readonly kind: string };

/**
 * Whether Theme Studio is open, the section it shows, the kind Components shows (a component
 * type, `Button`; its first kind while none is chosen), its look's changes not applied yet, and
 * what waits on the question about them.
 */
export type StudioState = {
  readonly open: boolean;
  readonly section: StudioSection;
  readonly kind?: string | undefined;
  readonly draft?: LookDraft | undefined;
  readonly pending?: DraftPending | undefined;
};

/**
 * Theme Studio's state, made once for the window: the Theme tab's button and View → Theme Studio…
 * open it, and the tab draws it, so it stays as it was while the tab is hidden and shown again.
 */
export function createStudio(): StoreApi<StudioState> {
  return createStore<StudioState>()(() => ({ open: false, section: "themes" }));
}
