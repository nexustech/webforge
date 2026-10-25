import { type MediaId, type MediaMeta, mediaNameFor, newId } from "@webforge/model";
import type { MediaImportResult } from "../shared/ipc-contract.js";
import type { ImportFileResult, ProjectSession } from "./project-session.js";

/**
 * A file to import: one the main process found (chosen in the dialog, dropped, or copied in the
 * file manager), by its path, or bytes (a pasted image; `undefined` when it was too large to read).
 */
export type ImportFile =
  | { readonly fileName: string; readonly path: string }
  | { readonly fileName: string; readonly data: Uint8Array | undefined };

/** Why an import stopped: no site, a read-only site, or a write error. */
type ImportFailure = Extract<ImportFileResult, { status: "failed" }>;

/**
 * An import in progress: files are added one at a time, and the storage writer reads, checks and
 * stores each, off the main thread (R13b). Each file's original bytes are stored in the open site
 * (F-ED-5, X2: never re-encoded) and described as a Media item. Files Media doesn't take are
 * listed as rejected; the rest are still imported. The items' names are unique within this
 * import; the renderer makes them unique within the site when it adds them.
 */
export function createMediaImport(
  session: Pick<ProjectSession, "importFile">,
  createId: () => MediaId = () => newId("media"),
) {
  const items: MediaMeta[] = [];
  const rejected: { fileName: string; reason: "unsupported" | "too-large" | "not-text" }[] = [];
  return {
    /** Imports one file; gives why the import has to stop, if it does. One file at a time. */
    async add(file: ImportFile): Promise<ImportFailure | undefined> {
      const { fileName } = file;
      if ("data" in file && file.data === undefined) {
        rejected.push({ fileName, reason: "too-large" });
        return undefined;
      }
      const id = createId();
      const result = await session.importFile(
        id,
        fileName,
        "path" in file ? { path: file.path } : { data: file.data ?? new Uint8Array() },
      );
      switch (result.status) {
        case "failed":
          return result;
        case "skipped":
          // A folder, or a file that is gone: not one Media takes.
          rejected.push({ fileName, reason: "unsupported" });
          return undefined;
        case "rejected":
          rejected.push({ fileName, reason: result.reason });
          return undefined;
      }
      const { media } = result;
      const base = {
        id,
        hash: result.hash,
        name: mediaNameFor(
          fileName,
          media.kind,
          items.map((item) => item.name),
        ),
        fileName,
      };
      items.push(
        media.kind === "image"
          ? { ...base, ...media, alt: "" }
          : { ...base, ...media, size: result.size },
      );
      return undefined;
    },
    /** What was imported and what wasn't. */
    result(): MediaImportResult {
      return { status: "imported", items: [...items], rejected: [...rejected] };
    },
  };
}

/** Imports `files`, one at a time; see {@link createMediaImport}. */
export async function importMediaFiles(
  session: Pick<ProjectSession, "importFile">,
  files: readonly ImportFile[],
  createId?: () => MediaId,
): Promise<MediaImportResult> {
  const running = createMediaImport(session, createId);
  for (const file of files) {
    const failed = await running.add(file);
    if (failed !== undefined) {
      return failed;
    }
  }
  return running.result();
}
