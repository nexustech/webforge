import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { type FileHandle, open, stat } from "node:fs/promises";
import { MAX_IMAGE_PIXELS } from "@webforge/model";
import { type BlobAsset, type NewBlob, SiteFileWriter } from "@webforge/storage";
import { isTextName } from "../shared/document-files.js";
import { MAX_MEDIA_BYTES } from "../shared/ipc/media.js";
import { sniffMedia } from "../shared/media-files.js";
import type {
  CleanUpOutcome,
  ImportSource,
  PrepareOutcome,
  PutBlobsOutcome,
  StoreOutcome,
} from "../shared/storage-writer-protocol.js";

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
 * a folder, a pipe or a device, or a file that is gone (a copy pasted after the file moved). The
 * path is looked at before it is opened, and opened without waiting, so one that isn't a regular
 * file never holds the import up: opening a pipe would wait for a writer that may never come.
 */
async function readFile(path: string): Promise<Uint8Array | "too-large" | undefined> {
  const found = await stat(path).catch(() => undefined);
  if (found === undefined || !found.isFile()) {
    return undefined;
  }
  // O_NONBLOCK, where there is one: the path may have become a pipe since it was looked at.
  const flags = constants.O_RDONLY | (constants.O_NONBLOCK ?? 0);
  const handle = await open(path, flags).catch(() => undefined);
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

/** An import read, checked and hashed, waiting to be stored. */
type Prepared = {
  readonly data: Uint8Array;
  readonly hash: string;
  readonly media: Exclude<ReturnType<typeof sniffMedia>, undefined>;
};

/** What the jobs write a site's file with: a {@link SiteFileWriter}, or a fake in tests. */
type FileWriter = Pick<SiteFileWriter, "put" | "putBlobs" | "cleanUp" | "close">;

/**
 * The storage writer's work (R13b, ADR 0013), in its thread or, for tests, on the calling one. An
 * import takes two steps:
 * - `prepare` reads the file (or takes the bytes), checks it is one Media takes (F-ED-5: a JPEG
 *   or PNG of at most 50 megapixels, or a document) and hashes it. The site's file isn't touched,
 *   so the main process goes on saving meanwhile, however slow the file is to read.
 * - `store` writes the prepared bytes, unmodified (X2), as a Media item's asset, in the site's
 *   file through a connection of its own, while the main process waits at the store gate.
 * Prepared bytes are kept by id until stored or discarded. `putBlobs` stores pasted or downloaded
 * files, and `cleanUp` cleans a closing site's file up, each in one step, while the main process
 * waits at the gate (#664). `openWriter` is for tests.
 */
export function createWriterJobs(openWriter: (path: string) => FileWriter = SiteFileWriter.open) {
  /** `work` with a writer to the file at `sitePath`, closed after it; `undefined` if either fails. */
  const withWriter = <T>(sitePath: string, work: (writer: FileWriter) => T): T | undefined => {
    let writer: FileWriter;
    try {
      writer = openWriter(sitePath);
    } catch {
      return undefined;
    }
    try {
      return work(writer);
    } catch {
      return undefined;
    } finally {
      writer.close();
    }
  };
  const prepared = new Map<number, Prepared>();
  return {
    async prepare(id: number, fileName: string, source: ImportSource): Promise<PrepareOutcome> {
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
      const hash = createHash("sha256").update(data).digest("hex");
      prepared.set(id, { data, hash, media });
      return { status: "prepared", hash, size: data.byteLength, media: { ...media } };
    },
    store(
      id: number,
      at: { readonly sitePath: string; readonly mediaId: string; readonly originalName: string },
    ): StoreOutcome {
      const ready = prepared.get(id);
      prepared.delete(id);
      if (ready === undefined) {
        return { status: "failed" };
      }
      const { data, hash, media } = ready;
      const stored = withWriter(at.sitePath, (writer) =>
        writer.put(
          {
            mediaId: at.mediaId,
            data,
            mime: media.mimeType,
            ...(media.kind === "image" ? { width: media.width, height: media.height } : {}),
            originalName: at.originalName,
          },
          hash,
        ),
      );
      return stored === undefined ? { status: "failed" } : { status: "stored" };
    },
    discard(id: number): void {
      prepared.delete(id);
    },
    putBlobs(sitePath: string, blobs: readonly NewBlob[], asset?: BlobAsset): PutBlobsOutcome {
      const hashes = withWriter(sitePath, (writer) => writer.putBlobs(blobs, asset));
      return hashes === undefined ? { status: "failed" } : { status: "put", hashes };
    },
    cleanUp(sitePath: string): CleanUpOutcome {
      const report = withWriter(sitePath, (writer) => writer.cleanUp());
      return report === undefined ? { status: "failed" } : { status: "cleaned", ...report };
    },
  };
}

/** See {@link createWriterJobs}. */
export type WriterJobs = ReturnType<typeof createWriterJobs>;
