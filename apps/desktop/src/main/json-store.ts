import * as fs from "node:fs/promises";
import { basename, dirname, extname, join } from "node:path";
import type { z } from "zod";

/** The file operations a JSON store uses: Node's, or a stand-in in tests. */
export type JsonStoreFiles = {
  readonly readFile: (path: string, encoding: "utf8") => Promise<string>;
  readonly writeFile: (
    path: string,
    data: string,
    options: { readonly encoding: "utf8"; readonly mode: number },
  ) => Promise<void>;
  readonly rename: (from: string, to: string) => Promise<void>;
  readonly mkdir: (path: string, options: { readonly recursive: true }) => Promise<unknown>;
};

/**
 * What a store does with a file it can't read (not JSON, or not its schema, as a newer build's
 * may be): `move-aside` keeps it as `<name>.damaged-<time>.json` before anything is written over
 * it, for a file whose loss would cost the person something (saved passwords, their themes);
 * `reset` writes over it, for one the app can rebuild (preferences, the Recent list).
 */
export type DamagedPolicy = "move-aside" | "reset";

/** One JSON file in the app's user data, read and written one operation at a time. */
export type JsonStore<T> = {
  /**
   * What the file holds; `empty` when there is none, or it can't be read as the schema says. A
   * file that's there but can't be opened now (locked by antivirus, the indexer or a sync client;
   * no permission) is an error, never "empty", so nothing is written over it.
   */
  read(): Promise<T>;
  /**
   * Writes what `change` makes of the file's value, after every operation asked before it, or
   * nothing when it returns `undefined`. Resolves once the file is renamed into place.
   */
  update(change: (current: T) => T | undefined): Promise<void>;
  /** Resolves once every operation asked so far is done: before the app exits. */
  idle(): Promise<void>;
};

/** How many times a rename is tried while the file is briefly locked. */
const RENAME_ATTEMPTS = 5;

/** Whether `error` is a file being briefly locked, as Windows does (antivirus, the indexer). */
const isLocked = (error: unknown) => {
  const code = (error as NodeJS.ErrnoException).code;
  return code === "EPERM" || code === "EBUSY" || code === "EACCES";
};

/** No file, or a parent that is a file (Linux reports ENOTDIR where Windows says ENOENT). */
const isMissing = (error: unknown) => {
  const code = (error as NodeJS.ErrnoException).code;
  return code === "ENOENT" || code === "ENOTDIR";
};

/** A time for a file name: `2026-10-27T09-30-00-000Z`. */
const stamp = (date: Date) => date.toISOString().replace(/[:.]/g, "-");

/** What reading the file found: its value, or that it's there but damaged. */
type Stored<T> = { readonly value: T; readonly damaged: boolean };

/**
 * A JSON file in the app's user data (#666), kept the way every such file is:
 * - **one operation at a time,** in the order asked, so two saves can't lose each other's changes
 *   and an older write never lands after a newer one;
 * - **checked when read** with `schema`, and `empty` when missing or damaged, `onDamaged` saying
 *   what becomes of a damaged file ({@link DamagedPolicy});
 * - **written whole:** to `<file>.tmp`, then renamed over the file, so a crash never leaves half
 *   of one; the rename is tried again while either file is briefly locked.
 *
 * Nothing of a file's content is logged; errors carry the file system's code only.
 */
export function createJsonStore<T>(
  file: string,
  schema: z.ZodType<T>,
  options: {
    readonly empty: T;
    readonly onDamaged: DamagedPolicy;
    /** The temporary file's permissions: owner-only (`0o600`) for secrets. */
    readonly mode?: number;
    readonly files?: JsonStoreFiles;
    readonly now?: () => Date;
    /** The pause before trying a locked rename again, by attempt; 100 ms × the attempt. */
    readonly pause?: (attempt: number) => Promise<void>;
  },
): JsonStore<T> {
  const files: JsonStoreFiles = options.files ?? fs;
  const now = options.now ?? (() => new Date());
  const pause =
    options.pause ??
    ((attempt: number) => new Promise<void>((resolve) => setTimeout(resolve, 100 * attempt)));
  let queue: Promise<unknown> = Promise.resolve();

  /** Runs `job` after every job asked before it, whether they worked or not. */
  function inTurn<R>(job: () => Promise<R>): Promise<R> {
    const result = queue.then(job, job);
    queue = result.catch(() => undefined);
    return result;
  }

  /** Renames `from` to `to`, a few times while either is briefly locked. */
  const rename = async (from: string, to: string) => {
    for (let attempt = 1; ; attempt++) {
      try {
        await files.rename(from, to);
        return;
      } catch (error) {
        if (attempt >= RENAME_ATTEMPTS || !isLocked(error)) throw error;
        await pause(attempt);
      }
    }
  };

  const load = async (): Promise<Stored<T>> => {
    let text: string;
    try {
      text = await files.readFile(file, "utf8");
    } catch (error) {
      if (isMissing(error)) return { value: options.empty, damaged: false };
      throw error;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return { value: options.empty, damaged: true };
    }
    const checked = schema.safeParse(parsed);
    return checked.success
      ? { value: checked.data, damaged: false }
      : { value: options.empty, damaged: true };
  };

  const save = async (stored: Stored<T>, value: T) => {
    const dir = dirname(file);
    await files.mkdir(dir, { recursive: true });
    if (stored.damaged && options.onDamaged === "move-aside") {
      const name = basename(file, extname(file));
      await rename(file, join(dir, `${name}.damaged-${stamp(now())}.json`));
    }
    const temp = `${file}.tmp`;
    await files.writeFile(temp, `${JSON.stringify(value, null, 2)}\n`, {
      encoding: "utf8",
      mode: options.mode ?? 0o666,
    });
    await rename(temp, file);
  };

  return {
    read: () => inTurn(async () => (await load()).value),
    update: (change) =>
      inTurn(async () => {
        const stored = await load();
        const next = change(stored.value);
        if (next !== undefined) await save(stored, next);
      }),
    idle: () => inTurn(() => Promise.resolve()),
  };
}
