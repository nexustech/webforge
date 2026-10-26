import { randomBytes } from "node:crypto";
import { open, rm, stat } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { sitePathSchema } from "@webforge/model";
import { Zip, ZipDeflate, ZipPassThrough } from "fflate";
import { EXPORT_MARKER, exportMarkerFor, renameWithRetry, WriteError } from "./write.js";

/** Files that are compressed already: stored as they are, which is faster and no bigger. */
const STORED = /\.(?:webp|jpe?g|png|gif|woff2|pdf|docx|xlsx|pptx|odt|ods|odp|zip)$/i;

/** Every entry's date: a fixed one, so the same site always makes the same ZIP. */
const ENTRY_DATE = new Date(2000, 0, 1);

/** Throws a `cancelled` {@link WriteError} once `signal` is aborted. */
function stopIfCancelled(signal: AbortSignal | undefined): void {
  if (signal?.aborted === true) throw new WriteError("cancelled", "The export was cancelled");
}

/**
 * Writes the site as a ZIP at `destination` (F-EX-1, 3.3), a file the person chose in the save
 * dialog (which asked before replacing one). The export's marker goes in too, so unpacking it and
 * exporting there again replaces it like any earlier export.
 *
 * It's written beside the destination one file at a time, so it never holds a second copy of the
 * site in memory, and then moved into place: a failure or a cancel leaves what was there as it was.
 */
export async function writeSiteZip(
  files: ReadonlyMap<string, Uint8Array>,
  destination: string,
  signal?: AbortSignal,
): Promise<void> {
  for (const path of files.keys()) {
    if (!sitePathSchema.safeParse(path).success) {
      throw new WriteError("write-failed", "A site file's path leads outside the site's folder");
    }
  }
  const existing = await stat(destination).catch(() => undefined);
  if (existing?.isDirectory() === true) {
    throw new WriteError("write-failed", "The destination is a folder");
  }
  stopIfCancelled(signal);
  const staging = join(
    dirname(destination),
    `.${basename(destination)}.webforge-new-${randomBytes(4).toString("hex")}`,
  );
  try {
    const handle = await open(staging, "w");
    try {
      // fflate hands each piece over as it makes it; they're written in order, one file's worth at
      // a time.
      let written: Promise<unknown> = Promise.resolve();
      let failed: Error | null = null;
      const zip = new Zip((error, piece) => {
        if (error !== null) failed = error;
        else written = written.then(() => handle.write(piece));
      });
      const entries: [string, Uint8Array][] = [
        ...files,
        [EXPORT_MARKER, new TextEncoder().encode(exportMarkerFor(files.keys()))],
      ];
      for (const [path, data] of entries) {
        stopIfCancelled(signal);
        const entry = STORED.test(path)
          ? new ZipPassThrough(path)
          : new ZipDeflate(path, { level: 6 });
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
    await renameWithRetry(staging, destination);
  } catch (error) {
    await rm(staging, { force: true });
    if (error instanceof WriteError) throw error;
    throw new WriteError("write-failed", "Could not write the ZIP file", { cause: error });
  }
}
