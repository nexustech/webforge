import type { ThemeTokens } from "@webforge/model";
import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";
import type { OwnTheme } from "../../shared/ipc/themes.js";
import type { OwnThemes, OwnThemesState } from "./own-themes.js";

/** No themes: for a Theme tab or Studio without My themes (stories, tests). */
const NONE = createStore<OwnThemesState>()(() => ({ themes: [], question: null }));

/**
 * The person's own themes to list (2.22): those in My themes on this computer, and the site's own
 * theme first if they aren't there (a site made on another computer), so it's always listed.
 */
export function ownThemeList(library: readonly OwnTheme[], site: ThemeTokens): readonly OwnTheme[] {
  const own = site.own;
  if (own === undefined || library.some((theme) => theme.own.id === own.id)) return library;
  return [{ ...site, own }, ...library];
}

/** {@link ownThemeList} from `ownThemes`' store, as it changes. */
export function useOwnThemeList(
  ownThemes: OwnThemes | undefined,
  site: ThemeTokens,
): readonly OwnTheme[] {
  const library = useStore(ownThemes?.store ?? NONE, (state) => state.themes);
  return ownThemeList(library, site);
}
