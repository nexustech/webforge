import type { ThemeTokens } from "@webforge/model";
import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";
import type { OwnTheme } from "../../shared/ipc/themes.js";
import type { OwnThemes, OwnThemesState } from "./own-themes.js";

/** No themes: for a Theme tab or Studio without My themes (stories, tests). */
const NONE = createStore<OwnThemesState>()(() => ({ themes: [], question: null, deleted: [] }));

/**
 * The person's own themes to list (2.23): those in My themes on this computer, the site's own
 * theme as the site has it (the latest of it, which My themes is given as it changes), and first if
 * My themes doesn't have it (a site made on another computer), unless it was `deleted` from My
 * themes in this window.
 */
export function ownThemeList(
  library: readonly OwnTheme[],
  site: ThemeTokens,
  deleted: readonly string[] = [],
): readonly OwnTheme[] {
  const own = site.own;
  if (own === undefined || deleted.includes(own.id)) return library;
  const mine = { ...site, own };
  return library.some((theme) => theme.own.id === own.id)
    ? library.map((theme) => (theme.own.id === own.id ? mine : theme))
    : [mine, ...library];
}

/** {@link ownThemeList} from `ownThemes`' store, as it changes. */
export function useOwnThemeList(
  ownThemes: OwnThemes | undefined,
  site: ThemeTokens,
): readonly OwnTheme[] {
  const { themes, deleted } = useStore(ownThemes?.store ?? NONE);
  return ownThemeList(themes, site, deleted);
}
