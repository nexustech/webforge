import { type FileHandle, open } from "node:fs/promises";
import { AssetWriter } from "@webforge/storage";
import { isTextName } from "../main/document-files.js";
import { sniffMedia } from "../main/media-files.js";
import { MAX_MEDIA_BYTES } from "../shared/ipc/media.js";
import type { StoreImportOutcome, StoreImportRequest } from "../shared/storage-writer-protocol.js";

/**
 * The most pixels an imported image may have (50 megapixels, e.g. 8660 × 5774). A small file can
 * claim a huge size; decoding it for thumbnails and the export would exhaust memory.
 */
const MAX_IMAGE_PIXELS = 50_000_000;

/** How much of a file is read at a time. */
const CHUNK_BYTES = 1024 * 1024;

/**
 * The bytes of the open file `handle`, read to its end, or `undefined` once there are more than
 * `maxBytes`: a file that grows after its size was checked is never read whole.
 */
export async function readAtMost(
  handle: Pick<FileHandle, "read">,
  maxBytes: number,
): Promise<Uint8Array | undefined> {
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const chunk = new Uint8Array(Math.min(CHUNK_BYTES, maxBytes + 1 - total));
    const { bytesRead } = await handle.read(chunk, 0, chunk.length, null);
    if (bytesRead === 0) break;
    total += bytesRead;
    if (total > maxBytes) return undefined;
    chunks.push(chunk.subarray(0, bytesRead));
  }
  return Buffer.concat(chunks, total);
}

/**
 * The bytes of the file at `path`, read through one open handle: its size is checked on that
 * handle, and no more than the size limit is read (`too-large` when it is over). `undefined` for
 * a folder, or a file that is gone (a copy pasted after the file moved).
 */
async function readFile(path: string): Promise<Uint8Array | "too-large" | undefined> {
  const handle = await open(path, "r").catch(() => undefined);
  if (handle === undefined) {
    return undefined;
  }
  try {
    const info = await handle.stat();
    if (!info.isFile()) {
      return undefined;
    }
    if (info.size > MAX_MEDIA_BYTES) {
      return "too-large";
    }
    return (await readAtMost(handle, MAX_MEDIA_BYTES)) ?? "too-large";
  } finally {
    await handle.close();
  }
}

/**
 * One import (R13b, ADR 0013): reads the file (or takes the bytes), checks it is one Media takes
 * (F-ED-5: a JPEG or PNG of at most 50 megapixels, or a document), and stores its original bytes,
 * unmodified (X2), as the Media item's asset, in the site's file through a connection of its own.
 * Runs in the storage writer thread, so none of it holds up the main thread; `openWriter` is for
 * tests.
 */
export async function storeImport(
  request: StoreImportRequest,
  openWriter: (path: string) => Pick<AssetWriter, "put" | "close"> = AssetWriter.open,
): Promise<StoreImportOutcome> {
  const { fileName, source } = request;
  const data = "path" in source ? await readFile(source.path) : source.data;
  if (data === undefined) {
    return { status: "skipped" };
  }
  if (data === "too-large" || data.byteLength > MAX_MEDIA_BYTES) {
    return { status: "rejected", reason: "too-large" };
  }
  const media = sniffMedia(data, fileName);
  if (media === undefined) {
    return { status: "rejected", reason: isTextName(fileName) ? "not-text" : "unsupported" };
  }
  if (media.kind === "image" && media.width * media.height > MAX_IMAGE_PIXELS) {
    return { status: "rejected", reason: "too-large" };
  }
  let writer: Pick<AssetWriter, "put" | "close">;
  try {
    writer = openWriter(request.sitePath);
  } catch {
    return { status: "failed" };
  }
  try {
    const hash = writer.put({
      mediaId: request.mediaId,
      data,
      mime: media.mimeType,
      ...(media.kind === "image" ? { width: media.width, height: media.height } : {}),
      originalName: fileName,
    });
    return { status: "stored", hash, size: data.byteLength, media: { ...media } };
  } catch {
    return { status: "failed" };
  } finally {
    writer.close();
  }
}
