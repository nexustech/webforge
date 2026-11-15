import { randomBytes } from "node:crypto";
import { open, rename, rm } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
// Its browser build: the same API without the Node build's own `require`, which clashes with the
// one the desktop app's main bundle declares in a chunk it shares (as `site-zip.ts` has it).
import { Zip, ZipDeflate, ZipPassThrough } from "fflate/browser";

// Writing a ZIP beside its destination and moving it into place (#987): the site's ZIP
// (`site-zip.ts`) and the export's (`@webforge/pipeline`'s `writeSiteZip`) both write one so, and
// the pipeline imports this module alone (`@webforge/storage/zip-writer`), not the store.

/** The most entries a ZIP holds without ZIP64, which fflate doesn't write. */
export const ZIP_MAX_ENTRIES = 0xffff;

/** Every entry's date: a fixed one, so the same files always make the same ZIP. */
const ENTRY_DATE = new Date(2000, 0, 1);

/**
 * Whether `entries` fit in a ZIP: {@link ZIP_MAX_ENTRIES}, and at most `maxBytes` in all, each
 * entry's local header and central directory entry counted, with its path.
 */
export function fitsInZip(
  entries: Iterable<readonly [string, Uint8Array]>,
  maxBytes: number,
): boolean {
  const encoder = new TextEncoder();
  let count = 0;
  let bytes = 0;
  for (const [path, data] of entries) {
    count += 1;
    bytes += data.byteLength + 76 + 2 * encoder.encode(path).byteLength;
  }
  return count <= ZIP_MAX_ENTRIES && bytes <= maxBytes;
}

/** How {@link writeZipAtomically} writes. */
export type ZipWriteOptions = {
  /** Whether the entry at `path` is compressed already (a picture), so stored as it is. */
  readonly stored: (path: string) => boolean;
  /** Stops the write before the next entry, throwing its reason: what was there stays. */
  readonly signal?: AbortSignal | undefined;
  /** Moves the written ZIP into place: `rename`, or one that retries a file another holds. */
  readonly rename?: ((from: string, to: string) => Promise<void>) | undefined;
};

/**
 * Writes `entries` as a ZIP at `destination`: beside it under a hidden name, one entry at a time
 * as fflate makes it, so it never holds a second copy in memory, then moved into place. A failure
 * or a cancel removes what it wrote and leaves what was at `destination` as it was. Each entry is
 * deflated (level 6) unless `stored`, and dated {@link ENTRY_DATE}.
 */
export async function writeZipAtomically(
  entries: Iterable<readonly [string, Uint8Array]>,
  destination: string,
  options: ZipWriteOptions,
): Promise<void> {
  const { stored, signal } = options;
  const staging = join(
    dirname(destination),
    `.${basename(destination)}.webforge-new-${randomBytes(4).toString("hex")}`,
  );
  try {
    const handle = await open(staging, "w");
    try {
      // fflate hands each piece over as it makes it; they're written in order, one entry's worth
      // at a time.
      let written: Promise<unknown> = Promise.resolve();
      let failed: Error | null = null;
      const zip = new Zip((error, piece) => {
        if (error !== null) failed = error;
        else written = written.then(() => handle.write(piece));
      });
      for (const [path, data] of entries) {
        signal?.throwIfAborted();
        const entry = stored(path) ? new ZipPassThrough(path) : new ZipDeflate(path, { level: 6 });
        entry.mtime = ENTRY_DATE;
        zip.add(entry);
        entry.push(data, true);
        await written;
        if (failed !== null) throw failed;
      }
      zip.end();
      await written;
      if (failed !== null) throw failed;
    } finally {
      await handle.close();
    }
    await (options.rename ?? rename)(staging, destination);
  } catch (error) {
    await rm(staging, { force: true });
    throw error;
  }
}
