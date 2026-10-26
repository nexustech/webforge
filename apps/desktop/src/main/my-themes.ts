import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { MAX_OWN_THEMES, type OwnTheme, ownThemeSchema } from "../shared/ipc/themes.js";

/** The file's shape: its version, then the themes, most recently kept first. */
const fileSchema = z.strictObject({ version: z.literal(1), themes: z.array(z.unknown()) });

/**
 * My themes (2.23, PH2-17): the person's own themes, kept in `userData/themes.json` so every site
 * on this computer can use them. Not site content (each site keeps its own copy of its theme), and
 * nothing of it is logged. A theme this build can't read is skipped, the rest kept; a damaged or
 * unknown file just means none.
 */
export function createMyThemes(options: { readonly dir: string; readonly max?: number }) {
  const max = options.max ?? MAX_OWN_THEMES;
  const file = join(options.dir, "themes.json");

  /** Every entry as stored: the ones this build reads, and any it doesn't, kept as they are. */
  const readRaw = (): unknown[] => {
    try {
      return fileSchema.parse(JSON.parse(readFileSync(file, "utf8"))).themes;
    } catch {
      return [];
    }
  };

  const idOf = (entry: unknown): string | undefined => {
    const own = (entry as { own?: { id?: unknown } } | null)?.own;
    return typeof own?.id === "string" ? own.id : undefined;
  };

  const write = (themes: readonly unknown[]) => {
    mkdirSync(options.dir, { recursive: true });
    // Write and rename, so a crash never leaves half a list.
    const temp = `${file}.tmp`;
    writeFileSync(temp, JSON.stringify({ version: 1, themes }, null, 2));
    renameSync(temp, file);
  };

  return {
    /** The themes this build can read, most recently kept first. */
    list(): OwnTheme[] {
      return readRaw().flatMap((entry) => {
        const theme = ownThemeSchema.safeParse(entry);
        return theme.success ? [theme.data] : [];
      });
    },
    /** Keeps `theme` first, in place of the one with its id if there is one. */
    keep(theme: OwnTheme): void {
      const others = readRaw().filter((entry) => idOf(entry) !== theme.own.id);
      write([theme, ...others].slice(0, max));
    },
    /** Removes the theme with `id`, if it is kept. */
    remove(id: string): void {
      const themes = readRaw();
      const kept = themes.filter((entry) => idOf(entry) !== id);
      if (kept.length !== themes.length) write(kept);
    },
  };
}

/** See {@link createMyThemes}. */
export type MyThemes = ReturnType<typeof createMyThemes>;
