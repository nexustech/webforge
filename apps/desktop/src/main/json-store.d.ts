import type { z } from "zod";
/** The file operations a JSON store uses: Node's, or a stand-in in tests. */
export type JsonStoreFiles = {
  readonly readFile: (path: string, encoding: "utf8") => Promise<string>;
  readonly writeFile: (
    path: string,
    data: string,
    options: {
      readonly encoding: "utf8";
      readonly mode: number;
    },
  ) => Promise<void>;
  readonly rename: (from: string, to: string) => Promise<void>;
  readonly mkdir: (
    path: string,
    options: {
      readonly recursive: true;
    },
  ) => Promise<unknown>;
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
export declare function createJsonStore<T>(
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
): JsonStore<T>;
//# sourceMappingURL=json-store.d.ts.map
