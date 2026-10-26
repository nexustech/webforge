import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { MAX_OWN_THEMES, type OwnTheme, ownThemeSchema } from "../shared/ipc/themes.js";

/** The file's shape: its version, then the themes, most recently kept first. */
const fileSchema = z.strictObject({ version: z.literal(1), themes: z.array(z.unknown()) });

/** What the file holds: its entries, or that it's there but can't be read (damaged, or newer). */
type Stored =
  | { readonly kind: "entries"; readonly themes: readonly unknown[] }
  | { readonly kind: "unreadable" };

/** What keeping a theme did: kept it, or not, because My themes holds as many as it may. */
export type KeepOutcome = "kept" | "full";

const idOf = (entry: unknown): string | undefined => {
  const own = (entry as { own?: { id?: unknown } } | null)?.own;
  return typeof own?.id === "string" ? own.id : undefined;
};

/** A time for a file name: `2026-10-27T09-30-00-000Z`. */
const stamp = (date: Date) => date.toISOString().replace(/[:.]/g, "-");

/**
 * My themes (2.23, PH2-17): the person's own themes, kept in `userData/themes.json` so every site
 * on this computer can use them. Not site content (each site keeps its own copy of its theme), and
 * nothing of it is logged. A theme this build can't read is skipped but kept as it is. A file it
 * can't read at all (damaged, or a newer build's) lists as none, and is moved aside as
 * `themes.damaged-<time>.json` before anything is written over it, so no theme is lost. Reads and
 * writes are asynchronous and one at a time, in the order asked.
 */
export function createMyThemes(options: {
  readonly dir: string;
  readonly max?: number;
  readonly now?: () => Date;
}) {
  const max = options.max ?? MAX_OWN_THEMES;
  const now = options.now ?? (() => new Date());
  const file = join(options.dir, "themes.json");
  let queue: Promise<unknown> = Promise.resolve();

  /** Runs `job` after every job asked before it, whether they worked or not. */
  function inTurn<T>(job: () => Promise<T>): Promise<T> {
    const result = queue.then(job, job);
    queue = result.catch(() => undefined);
    return result;
  }

  const read = async (): Promise<Stored> => {
    let text: string;
    try {
      text = await readFile(file, "utf8");
    } catch {
      // No file yet: no themes.
      return { kind: "entries", themes: [] };
    }
    try {
      return { kind: "entries", themes: fileSchema.parse(JSON.parse(text)).themes };
    } catch {
      return { kind: "unreadable" };
    }
  };

  /** Writes `themes`, moving an unreadable file aside first. */
  const write = async (stored: Stored, themes: readonly unknown[]) => {
    await mkdir(options.dir, { recursive: true });
    if (stored.kind === "unreadable") {
      await rename(file, join(options.dir, `themes.damaged-${stamp(now())}.json`));
    }
    // Write and rename, so a crash never leaves half a list.
    const temp = `${file}.tmp`;
    await writeFile(temp, JSON.stringify({ version: 1, themes }, null, 2));
    await rename(temp, file);
  };

  const entries = (stored: Stored) => (stored.kind === "entries" ? stored.themes : []);

  return {
    /** The themes this build can read, most recently kept first. */
    list(): Promise<OwnTheme[]> {
      return inTurn(async () =>
        entries(await read()).flatMap((entry) => {
          const theme = ownThemeSchema.safeParse(entry);
          return theme.success ? [theme.data] : [];
        }),
      );
    },
    /**
     * Keeps `theme` first, in place of the one with its id if there is one. A new theme isn't kept
     * once My themes holds its most: "full".
     */
    keep(theme: OwnTheme): Promise<KeepOutcome> {
      return inTurn(async () => {
        const stored = await read();
        const themes = entries(stored);
        const others = themes.filter((entry) => idOf(entry) !== theme.own.id);
        if (others.length === themes.length && themes.length >= max) return "full";
        await write(stored, [theme, ...others]);
        return "kept";
      });
    },
    /** Resolves once every read and write asked so far is done: before the app exits. */
    idle(): Promise<void> {
      return inTurn(() => Promise.resolve());
    },
    /** Removes the theme with `id`, if it is kept. */
    remove(id: string): Promise<void> {
      return inTurn(async () => {
        const stored = await read();
        const themes = entries(stored);
        const kept = themes.filter((entry) => idOf(entry) !== id);
        if (kept.length !== themes.length) await write(stored, kept);
      });
    },
  };
}

/** See {@link createMyThemes}. */
export type MyThemes = ReturnType<typeof createMyThemes>;
