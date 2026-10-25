import { type MediaId, type MediaMeta, mediaNameFor, newId } from "@webforge/model";
import { MAX_MEDIA_BYTES } from "../shared/ipc/media.js";
import type { MediaImportResult } from "../shared/ipc-contract.js";
import { isTextName } from "./document-files.js";
import { sniffMedia } from "./media-files.js";
import type { ProjectSession, StoreAssetResult } from "./project-session.js";

/**
 * The most pixels an imported image may have (50 megapixels, e.g. 8660 × 5774). A small file can
 * claim a huge size; decoding it for thumbnails and the export would exhaust memory.
 */
const MAX_IMAGE_PIXELS = 50_000_000;

/** A file to import: dropped (bytes from the renderer) or chosen in the dialog (read here). */
export type ImportFile = {
  readonly fileName: string;
  /** `undefined` when the file is over {@link MAX_MEDIA_BYTES} and wasn't read. */
  readonly data: Uint8Array | undefined;
};

/** Why an import stopped: no site, a read-only site, or a write error. */
type ImportFailure = Extract<StoreAssetResult, { status: "failed" }>;

/**
 * An import in progress: files are added one at a time, so a caller reading them from disk holds
 * only one in memory. Each file's original bytes are stored in the open site (F-ED-5, X2: never
 * re-encoded) and described as a Media item. Files Media doesn't take are listed as rejected; the
 * rest are still imported. The items' names are unique within this import; the renderer makes
 * them unique within the site when it adds them.
 */
export function createMediaImport(
  session: Pick<ProjectSession, "storeAsset">,
  createId: () => MediaId = () => newId("media"),
) {
  const items: MediaMeta[] = [];
  const rejected: { fileName: string; reason: "unsupported" | "too-large" | "not-text" }[] = [];
  return {
    /** Imports one file; gives why the import has to stop, if it does. One file at a time. */
    async add({ fileName, data }: ImportFile): Promise<ImportFailure | undefined> {
      if (data === undefined || data.byteLength > MAX_MEDIA_BYTES) {
        rejected.push({ fileName, reason: "too-large" });
        return undefined;
      }
      const sniffed = sniffMedia(data, fileName);
      if (sniffed === undefined) {
        rejected.push({ fileName, reason: isTextName(fileName) ? "not-text" : "unsupported" });
        return undefined;
      }
      if (sniffed.kind === "image" && sniffed.width * sniffed.height > MAX_IMAGE_PIXELS) {
        rejected.push({ fileName, reason: "too-large" });
        return undefined;
      }
      const id = createId();
      const stored = await session.storeAsset({
        mediaId: id,
        data,
        mime: sniffed.mimeType,
        originalName: fileName,
        ...(sniffed.kind === "image" ? { width: sniffed.width, height: sniffed.height } : {}),
      });
      if (stored.status === "failed") {
        return stored;
      }
      const base = {
        id,
        hash: stored.hash,
        name: mediaNameFor(
          fileName,
          sniffed.kind,
          items.map((item) => item.name),
        ),
        fileName,
      };
      items.push(
        sniffed.kind === "image"
          ? { ...base, ...sniffed, alt: "" }
          : { ...base, ...sniffed, size: data.byteLength },
      );
      return undefined;
    },
    /** Lists a file that isn't one Media can take, such as a folder, without importing it. */
    skip(fileName: string): void {
      rejected.push({ fileName, reason: "unsupported" });
    },
    /** What was imported and what wasn't. */
    result(): MediaImportResult {
      return { status: "imported", items: [...items], rejected: [...rejected] };
    },
  };
}

/** Imports files that are all in memory already (a drop); see {@link createMediaImport}. */
export async function importMediaFiles(
  session: Pick<ProjectSession, "storeAsset">,
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
