import { themeIdSchema, themeTokensSchema } from "@webforge/model";
import { z } from "zod";

/** The most themes My themes keeps on a computer. */
export const MAX_OWN_THEMES = 200;

/** One of the person's own themes (2.23): a theme with its id and name in My themes. */
export const ownThemeSchema = themeTokensSchema.extend({
  own: themeTokensSchema.shape.own.unwrap(),
});

/** A theme of the person's own: the site's theme tokens, with `own` set. */
export type OwnTheme = z.infer<typeof ownThemeSchema>;

/** IPC channels of the `themes` domain (`themes:*`). Each one's arguments are checked. */
export const themesChannels = {
  /** The person's own themes on this computer, most recently kept first. */
  listThemes: {
    channel: "themes:list",
    request: z.tuple([]),
    response: z.array(ownThemeSchema).max(MAX_OWN_THEMES),
  },
  /** Keeps one of the person's own themes, by its id: new, or in place of the one kept before. */
  keepTheme: {
    channel: "themes:keep",
    request: z.tuple([ownThemeSchema]),
    response: z.null(),
  },
  /** Removes one of the person's own themes from this computer; sites keep their copies. */
  removeTheme: {
    channel: "themes:remove",
    request: z.tuple([themeIdSchema]),
    response: z.null(),
  },
} as const;

/**
 * `window.webforge.themes`: My themes (2.23, PH2-17), the person's own themes kept on this computer
 * so their other sites can use them. Not site content: each site keeps its own copy of its theme.
 */
export interface ThemesApi {
  /** The person's own themes on this computer, most recently kept first. */
  list(): Promise<OwnTheme[]>;
  /** Keeps `theme`, new or in place of the one with its id. */
  keep(theme: OwnTheme): Promise<null>;
  /** Removes the theme with `id` from this computer. */
  remove(id: OwnTheme["own"]["id"]): Promise<null>;
}
