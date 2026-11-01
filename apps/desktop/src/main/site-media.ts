import { FILE_MIME_TYPES, IMAGE_MIME_TYPES, type MediaMeta } from "@webforge/model";
import type { BlobAsset, StoredBlob } from "@webforge/storage";
import type { ImportSource, PrepareOutcome } from "../shared/storage-writer-protocol.js";
import { BUNDLE_MIME_TYPES } from "./bundle-download.js";
import { log } from "./log.js";
import type { SiteStore, StaleReason } from "./site-store.js";
import type { PreparedImport } from "./storage-writer.js";

/** The blob types a Media item's file can have; documents (JSON) are never served as media. */
const MEDIA_MIME_TYPES: ReadonlySet<string> = new Set([...IMAGE_MIME_TYPES, ...FILE_MIME_TYPES]);

/** Outcome of storing an imported file in the open site. */
export type StoreAssetResult =
  | { readonly status: "stored"; readonly hash: string }
  | { readonly status: "failed"; readonly reason: StaleReason | "read-only" | "unknown" };

/** What came of storing files' bytes in the open site: their hashes, in order, or why not. */
export type StoreBlobsResult =
  | { readonly status: "stored"; readonly hashes: readonly string[] }
  | { readonly status: "failed"; readonly reason: StaleReason | "read-only" | "unknown" };

/**
 * What came of importing a file into the open site (R13b): stored, with what the storage writer
 * learnt of it; not a file Media takes; not a file at all; or why it couldn't be stored.
 */
export type ImportFileResult =
  | ({ readonly status: "stored" } & Omit<PreparedImport, "status" | "token">)
  | Extract<PrepareOutcome, { status: "rejected" | "skipped" }>
  | Extract<StoreAssetResult, { status: "failed" }>;

/** Where an imported file's bytes come from: a file the main process found, or bytes. */
export type { ImportSource };

/** The bytes of a Media file in the site, by hash: Media's files and the site code's (3.9), never a document. */
export function readMedia(site: SiteStore, hash: string): Promise<StoredBlob | undefined> {
  return site.withStore(
    "shared",
    (store) => {
      const blob = store.readBlob(hash);
      return blob !== undefined &&
        (MEDIA_MIME_TYPES.has(blob.mime) || BUNDLE_MIME_TYPES.has(blob.mime))
        ? blob
        : undefined;
    },
    () => undefined,
  );
}

function importFailed(): ImportFileResult {
  log.error("Webforge could not store an imported file");
  return { status: "failed", reason: "unknown" };
}

/** Imports a file as Media item `mediaId`'s asset (1.16, R13b). */
export async function importFile(
  site: SiteStore,
  mediaId: string,
  fileName: string,
  source: ImportSource,
): Promise<ImportFileResult> {
  const stale = site.staleReason();
  if (stale !== undefined) return { status: "failed", reason: stale };
  // First read, check and hash it, outside the gate: saves go on meanwhile, however slow the
  // file is to read (a network share), and a file that never opens holds up only its import.
  const prepared = await site.writer.prepare(fileName, source);
  if (prepared.status === "failed") return importFailed();
  if (prepared.status !== "prepared") return prepared;
  // Then store it alone, the bytes and the asset together: the main process's reads and saves
  // wait at the gate, as promises, and nothing of the import is written on its thread.
  const stored = await site.writerTurn<ImportFileResult | "stored" | "not-stored">(
    async (sitePath, writer) => {
      const outcome = await writer.store(prepared, {
        sitePath,
        mediaId,
        originalName: fileName,
      });
      return outcome.status === "stored" ? "stored" : "not-stored";
    },
    (reason) => {
      site.writer.discard(prepared);
      return { status: "failed", reason };
    },
  );
  if (stored === "not-stored") return importFailed();
  if (stored !== "stored") return stored;
  const { token: _token, status: _status, ...facts } = prepared;
  return { status: "stored", ...facts };
}

/**
 * Stores files' bytes in the open site, all or none, on the storage writer's turn (#664): hashed
 * and written off the main thread, as an import is.
 */
function putBlobs(
  site: SiteStore,
  blobs: readonly { readonly data: Uint8Array; readonly mime: string }[],
  asset: BlobAsset | undefined,
  event: string,
): Promise<StoreBlobsResult> {
  return site.writerTurn<StoreBlobsResult>(
    async (sitePath, writer) => {
      const outcome = await writer.putBlobs(sitePath, blobs, asset);
      if (outcome.status === "put") return { status: "stored", hashes: outcome.hashes };
      log.error(event);
      return { status: "failed", reason: "unknown" };
    },
    (reason) => ({ status: "failed", reason }),
  );
}

/** Stores files' bytes for the site's code, all or none (Download and bundle, 3.9). */
export function storeBlobs(
  site: SiteStore,
  files: readonly { readonly data: Uint8Array; readonly mime: string }[],
): Promise<StoreBlobsResult> {
  if (files.length === 0) return Promise.resolve({ status: "stored", hashes: [] });
  return putBlobs(site, files, undefined, "Webforge could not store a downloaded file");
}

/** Stores a pasted Media item's bytes, unless the site has them (1.25). */
export async function storeCopiedMedia(
  site: SiteStore,
  item: MediaMeta,
  read: () => Uint8Array | undefined,
): Promise<StoreAssetResult | { readonly status: "missing" }> {
  const found = await site.withStore<
    | StoreAssetResult
    | { readonly status: "missing" }
    | { readonly status: "store"; readonly data: Uint8Array; readonly hasAsset: boolean }
  >(
    "shared",
    (store) => {
      const hasAsset = store.readAsset(item.id) !== undefined;
      if (hasAsset && store.hasBlob(item.hash)) {
        return { status: "stored", hash: item.hash };
      }
      // The kept bytes, else the same bytes this site already has under another item.
      const data = read() ?? store.readBlob(item.hash)?.data;
      return data === undefined ? { status: "missing" } : { status: "store", data, hasAsset };
    },
    (reason) => ({ status: "failed", reason }),
  );
  if (found.status !== "store") return found;
  // An item of this site keeps its own asset (it may have been replaced since the copy).
  const asset: BlobAsset | undefined = found.hasAsset
    ? undefined
    : {
        mediaId: item.id,
        width: item.kind === "image" ? item.width : undefined,
        height: item.kind === "image" ? item.height : undefined,
        originalName: item.fileName,
      };
  const stored = await putBlobs(
    site,
    [{ data: found.data, mime: item.mimeType }],
    asset,
    "Webforge could not store a pasted file",
  );
  if (stored.status !== "stored") return stored;
  // Bytes that aren't the item's would leave it naming a file the site doesn't have.
  if (stored.hashes[0] !== item.hash) {
    log.error("Webforge could not store a pasted file");
    return { status: "failed", reason: "unknown" };
  }
  return { status: "stored", hash: item.hash };
}
