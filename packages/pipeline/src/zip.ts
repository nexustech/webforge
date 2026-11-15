import { stat } from "node:fs/promises";
import { sitePathSchema } from "@webforge/model";
import { fitsInZip, writeZipAtomically } from "@webforge/storage/zip-writer";
import { EXPORT_MARKER, exportMarkerFor, renameWithRetry, WriteError } from "./write.js";

/** Files that are compressed already: stored as they are, which is faster and no bigger. */
const STORED =
  /\.(?:webp|avif|jpe?g|png|gif|woff2|mp4|webm|mp3|m4a|pdf|docx|xlsx|pptx|odt|ods|odp|zip|gz|7z)$/i;

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
 * A site too large for a ZIP (over 4 GB, or 65,535 files) is refused before anything is written.
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
  const entries: [string, Uint8Array][] = [
    ...files,
    [EXPORT_MARKER, new TextEncoder().encode(exportMarkerFor(files.keys()))],
  ];
  // The export's marker is an entry too. Without ZIP64, which fflate doesn't write: 65,535 entries, and 4 GB in all.
  if (!fitsInZip(entries, 0xffff_ffff)) {
    throw new WriteError("too-large", "The site is too large for a ZIP file");
  }
  const existing = await stat(destination).catch(() => undefined);
  if (existing?.isDirectory() === true) {
    throw new WriteError("write-failed", "The destination is a folder");
  }
  stopIfCancelled(signal);
  try {
    await writeZipAtomically(entries, destination, {
      stored: (path) => STORED.test(path),
      signal,
      rename: renameWithRetry,
    });
  } catch (error) {
    if (signal?.aborted === true) throw new WriteError("cancelled", "The export was cancelled");
    if (error instanceof WriteError) throw error;
    throw new WriteError("write-failed", "Could not write the ZIP file", { cause: error });
  }
}
