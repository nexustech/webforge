import { randomBytes } from "node:crypto";
import { rm, stat, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { sitePathSchema } from "@webforge/model";
import { type Zippable, zipSync } from "fflate";
import { EXPORT_MARKER, exportMarkerFor, renameWithRetry, WriteError } from "./write.js";

/** Files that are compressed already: stored as they are, which is faster and no bigger. */
const STORED = /\.(?:webp|jpe?g|png|gif|woff2|pdf|docx|xlsx|pptx|odt|ods|odp|zip)$/i;

/** Every entry's date: a fixed one, so the same site always makes the same ZIP. */
const ENTRY_DATE = new Date(2000, 0, 1);

/**
 * The site's files as a ZIP (F-EX-1, 3.3), the export's marker among them so that unpacking it and
 * exporting there again replaces it like any earlier export.
 */
export function zipSite(files: ReadonlyMap<string, Uint8Array>): Uint8Array {
  const entries: Zippable = {};
  for (const [path, data] of files) {
    entries[path] = [data, { level: STORED.test(path) ? 0 : 6, mtime: ENTRY_DATE }];
  }
  entries[EXPORT_MARKER] = [
    new TextEncoder().encode(exportMarkerFor(files.keys())),
    { level: 6, mtime: ENTRY_DATE },
  ];
  return zipSync(entries);
}

/** Throws a `cancelled` {@link WriteError} once `signal` is aborted. */
function stopIfCancelled(signal: AbortSignal | undefined): void {
  if (signal?.aborted === true) throw new WriteError("cancelled", "The export was cancelled");
}

/**
 * Writes the site as a ZIP at `destination`, a file the person chose in the save dialog (which
 * asked before replacing one). It's written beside it first and then moved into place, so a
 * failure or a cancel leaves what was there as it was.
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
  const zip = zipSite(files);
  const staging = join(
    dirname(destination),
    `.${basename(destination)}.webforge-new-${randomBytes(4).toString("hex")}`,
  );
  try {
    await writeFile(staging, zip);
    stopIfCancelled(signal);
    await renameWithRetry(staging, destination);
  } catch (error) {
    await rm(staging, { force: true });
    if (error instanceof WriteError) throw error;
    throw new WriteError("write-failed", "Could not write the ZIP file", { cause: error });
  }
}
