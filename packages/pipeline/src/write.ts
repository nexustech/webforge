import { randomBytes } from "node:crypto";
import { mkdir, readdir, rename, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";

/**
 * File that marks a folder as a Webforge export. Webforge only replaces folders that are empty or
 * carry this marker, so it never deletes files a user put there themselves (X5).
 */
export const EXPORT_MARKER = ".webforge-export";

/** Why the site could not be written. */
export type WriteErrorCode = "folder-not-empty" | "write-failed";

/** Writing the export to disk failed; the destination is left as it was. */
export class WriteError extends Error {
  readonly code: WriteErrorCode;

  constructor(code: WriteErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "WriteError";
    this.code = code;
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
 * half-written site (export pipeline stage 10).
 */
export async function writeSiteFolder(
  files: ReadonlyMap<string, Uint8Array>,
  destination: string,
): Promise<void> {
  const existing = await entriesOf(destination);
  if (existing !== null && existing.length > 0 && !existing.includes(EXPORT_MARKER)) {
    throw new WriteError("folder-not-empty", "The folder contains files that are not an export");
  }

  const suffix = randomBytes(4).toString("hex");
  const parent = dirname(destination);
  const staging = join(parent, `.${basename(destination)}.webforge-new-${suffix}`);
  const previous = join(parent, `.${basename(destination)}.webforge-old-${suffix}`);
  try {
    await mkdir(staging, { recursive: true });
    for (const [path, data] of files) {
      const target = join(staging, ...path.split("/"));
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, data);
    }
    await writeFile(join(staging, EXPORT_MARKER), "Exported by Webforge.\n");
  } catch (error) {
    await rm(staging, { recursive: true, force: true });
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
  await rm(previous, { recursive: true, force: true });
}
