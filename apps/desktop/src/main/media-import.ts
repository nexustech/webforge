import { type MediaId, type MediaMeta, mediaNameFor, newId } from "@webforge/model";
import { MAX_MEDIA_BYTES } from "../shared/ipc/media.js";
import type { DroppedFile, MediaImportResult } from "../shared/ipc-contract.js";
import { sniffMedia } from "./media-files.js";
import type { ProjectSession } from "./project-session.js";

/** A file to import: dropped (bytes from the renderer) or chosen in the dialog (read here). */
export type ImportFile = {
  readonly fileName: string;
  /** `undefined` when the file is over {@link MAX_MEDIA_BYTES} and wasn't read. */
  readonly data: Uint8Array | undefined;
};

/**
 * Stores each file's original bytes in the open site (F-ED-5, X2: never re-encoded) and describes
 * it as a Media item. Files Media doesn't take are listed as rejected; the rest are still
 * imported. The items' names are unique within this import; the renderer makes them unique within
 * the site when it adds them.
 */
export function importMediaFiles(
  session: Pick<ProjectSession, "storeAsset">,
  files: readonly (DroppedFile | ImportFile)[],
  createId: () => MediaId = () => newId("media"),
): MediaImportResult {
  const items: MediaMeta[] = [];
  const rejected: { fileName: string; reason: "unsupported" | "too-large" }[] = [];
  for (const { fileName, data } of files) {
    if (data === undefined || data.byteLength > MAX_MEDIA_BYTES) {
      rejected.push({ fileName, reason: "too-large" });
      continue;
    }
    const sniffed = sniffMedia(data);
    if (sniffed === undefined) {
      rejected.push({ fileName, reason: "unsupported" });
      continue;
    }
    const id = createId();
    const stored = session.storeAsset({
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
      sniffed.kind === "image" ? { ...base, ...sniffed, alt: "" } : { ...base, ...sniffed },
    );
  }
  return { status: "imported", items, rejected };
}
