import { join } from "node:path";
import { z } from "zod";
import { MAX_OWN_THEMES, type OwnTheme, ownThemeSchema } from "../shared/ipc/themes.js";
import { createJsonStore, type JsonStoreFiles } from "./json-store.js";

/** The file's shape: its version, then the themes, most recently kept first. */
const fileSchema = z.strictObject({ version: z.literal(1), themes: z.array(z.unknown()) });

/** What keeping a theme did: kept it, or not, because My themes holds as many as it may. */
export type KeepOutcome = "kept" | "full";

/**
 * `entry` with an accent font (3.22): one kept before there was one has its headings' font, as a
 * site's theme does when it opens in format 11, so it looks the same. Anything else as it is, for
 * the schema to check.
 */
function withAccent(entry: unknown): unknown {
  if (typeof entry !== "object" || entry === null) return entry;
  const fonts = (entry as { fonts?: unknown }).fonts;
  if (typeof fonts !== "object" || fonts === null || "accent" in fonts || !("heading" in fonts)) {
    return entry;
  }
  return { ...entry, fonts: { ...fonts, accent: fonts.heading } };
}

const idOf = (entry: unknown): string | undefined => {
  const own = (entry as { own?: { id?: unknown } } | null)?.own;
  return typeof own?.id === "string" ? own.id : undefined;
};

/**
 * My themes (2.23, PH2-17): the person's own themes, kept in `userData/themes.json` so every site
 * on this computer can use them. Not site content (each site keeps its own copy of its theme), and
 * nothing of it is logged. A theme this build can't read is skipped but kept as it is. A file it
 * can't read at all (damaged, or a newer build's) lists as none, and is moved aside as
 * `themes.damaged-<time>.json` before anything is written over it, so no theme is lost. One that's
 * there but can't be opened now (locked by antivirus, the indexer or a sync client) is an error,
 * never "no themes", so nothing is written over it. Reads and writes go through
 * {@link createJsonStore}: one at a time, in the order asked, renames tried again while the file is
 * briefly locked.
 */
export function createMyThemes(options: {
  readonly dir: string;
  readonly max?: number;
  readonly now?: () => Date;
  readonly files?: JsonStoreFiles;
}) {
  const max = options.max ?? MAX_OWN_THEMES;
  const store = createJsonStore(join(options.dir, "themes.json"), fileSchema, {
    empty: { version: 1, themes: [] },
    onDamaged: "move-aside",
    ...(options.now === undefined ? {} : { now: options.now }),
    ...(options.files === undefined ? {} : { files: options.files }),
  });
  return {
    /** The themes this build can read, most recently kept first. */
    async list(): Promise<OwnTheme[]> {
      return (await store.read()).themes.flatMap((entry) => {
        const theme = ownThemeSchema.safeParse(withAccent(entry));
        return theme.success ? [theme.data] : [];
      });
    },
    /**
     * Keeps `theme` first, in place of the one with its id if there is one. A new theme isn't kept
     * once My themes holds its most: "full".
     */
    async keep(theme: OwnTheme): Promise<KeepOutcome> {
      let outcome: KeepOutcome = "kept";
      await store.update(({ themes }) => {
        const others = themes.filter((entry) => idOf(entry) !== theme.own.id);
        if (others.length === themes.length && themes.length >= max) {
          outcome = "full";
          return undefined;
        }
        return { version: 1, themes: [theme, ...others] };
      });
      return outcome;
    },
    /** Resolves once every read and write asked so far is done: before the app exits. */
    idle: () => store.idle(),
    /** Removes the theme with `id`, if it is kept. */
    remove(id: string): Promise<void> {
      return store.update(({ themes }) => {
        const kept = themes.filter((entry) => idOf(entry) !== id);
        return kept.length === themes.length ? undefined : { version: 1, themes: kept };
      });
    },
  };
}

/** See {@link createMyThemes}. */
export type MyThemes = ReturnType<typeof createMyThemes>;
