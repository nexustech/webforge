import { randomBytes } from "node:crypto";
import { mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join, relative, sep } from "node:path";
import { WebforgeError } from "@webforge/errors";
import { sitePathSchema } from "@webforge/model";
import { z } from "zod";

/**
 * File that marks a folder as a Webforge export and lists the files the export wrote. Webforge only
 * replaces a folder that is empty or holds nothing but those files, so it never deletes files a
 * user put there themselves (X5).
 */
export const EXPORT_MARKER = ".webforge-export";

const exportMarkerSchema = z.object({
  generator: z.literal("Webforge"),
  files: z.array(z.string()),
});

type ExportMarker = z.infer<typeof exportMarkerSchema>;

/** Whether every file in `folder` is one an earlier export listed in its marker. */
async function holdsOnlyAnEarlierExport(folder: string): Promise<boolean> {
  let listed: Set<string>;
  try {
    const marker = exportMarkerSchema.parse(
      JSON.parse(await readFile(join(folder, EXPORT_MARKER), "utf8")),
    );
    listed = new Set(marker.files);
  } catch {
    // No marker, or not one Webforge wrote: treat the folder as someone else's.
    return false;
  }
  const entries = await readdir(folder, { recursive: true, withFileTypes: true });
  return entries
    .filter((entry) => !entry.isDirectory())
    .every((entry) => {
      const path = relative(folder, join(entry.parentPath, entry.name)).split(sep).join("/");
      return path === EXPORT_MARKER || listed.has(path);
    });
}

/** Why the site could not be written; `cancelled`: the write's signal was aborted (R15). */
export type WriteErrorCode = "folder-not-empty" | "write-failed" | "cancelled";

/** Writing the export to disk failed; the destination is left as it was. */
export class WriteError extends WebforgeError<WriteErrorCode> {
  override readonly name = "WriteError";

  constructor(code: WriteErrorCode, message: string, options?: ErrorOptions) {
    super(
      code,
      code === "folder-not-empty" ? "export.failed.folderNotEmpty" : "export.failed.writeFailed",
      message,
      options,
    );
  }
}

/** The folder's entries, or `null` if it does not exist yet. */
async function entriesOf(folder: string): Promise<string[] | null> {
  try {
    return await readdir(folder);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      return null;
    }
    const message =
      code === "ENOTDIR" ? "The destination is not a folder" : "Could not read the destination";
    throw new WriteError("write-failed", message, { cause: error });
  }
}

/** Windows briefly locks folders (antivirus, indexer): retry a rename a few times. */
async function renameWithRetry(from: string, to: string): Promise<void> {
  for (let attempt = 1; ; attempt++) {
    try {
      await rename(from, to);
      return;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (attempt >= 5 || (code !== "EPERM" && code !== "EBUSY" && code !== "EACCES")) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 100 * attempt));
    }
  }
}

/**
 * Writes the site's files into `destination`, replacing a previous export there. The files go to
 * a temporary sibling folder first, which is then swapped in, so a failure never leaves a
 * half-written site (export pipeline stage 10). Aborting `signal` stops before the next file and
 * removes the temporary folder: the destination is left as it was (R15).
 */
export async function writeSiteFolder(
  files: ReadonlyMap<string, Uint8Array>,
  destination: string,
  signal?: AbortSignal,
): Promise<void> {
  // A file's path decides where it goes: one that leaves the folder is refused before anything is
  // written (R16). The snapshot schema checks pages' paths too; this holds for any caller.
  for (const path of files.keys()) {
    if (!sitePathSchema.safeParse(path).success) {
      throw new WriteError("write-failed", "A site file's path leads outside the site's folder");
    }
  }
  const existing = await entriesOf(destination);
  if (existing !== null && existing.length > 0 && !(await holdsOnlyAnEarlierExport(destination))) {
    throw new WriteError("folder-not-empty", "The folder contains files that are not an export");
  }

  const suffix = randomBytes(4).toString("hex");
  const parent = dirname(destination);
  const staging = join(parent, `.${basename(destination)}.webforge-new-${suffix}`);
  const previous = join(parent, `.${basename(destination)}.webforge-old-${suffix}`);
  try {
    await mkdir(staging, { recursive: true });
    for (const [path, data] of files) {
      if (signal?.aborted === true) throw new WriteError("cancelled", "The export was cancelled");
      const target = join(staging, ...path.split("/"));
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, data);
    }
    const marker: ExportMarker = { generator: "Webforge", files: [...files.keys()].sort() };
    await writeFile(join(staging, EXPORT_MARKER), `${JSON.stringify(marker, null, 2)}\n`);
  } catch (error) {
    await rm(staging, { recursive: true, force: true });
    if (error instanceof WriteError) throw error;
    throw new WriteError("write-failed", "Could not write the site files", { cause: error });
  }

  try {
    if (existing !== null) {
      await renameWithRetry(destination, previous);
    }
    try {
      await renameWithRetry(staging, destination);
    } catch (error) {
      if (existing !== null) {
        await renameWithRetry(previous, destination);
      }
      throw error;
    }
  } catch (error) {
    await rm(staging, { recursive: true, force: true });
    throw new WriteError("write-failed", "Could not replace the previous export", { cause: error });
  }
  // The new site is in place; failing to delete the old copy must not turn that into an error.
  await rm(previous, { recursive: true, force: true }).catch(() => {});
}
