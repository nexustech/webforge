import { IMAGE_MIME_TYPES } from "@webforge/model";
import type { StoredBlob } from "@webforge/storage";

/** How many thumbnails stay in memory; a site's Media panel rarely shows more. */
const THUMBNAIL_CACHE_SIZE = 300;

type ImageMime = (typeof IMAGE_MIME_TYPES)[number];

const isImageMime = (mime: string): mime is ImageMime =>
  (IMAGE_MIME_TYPES as readonly string[]).includes(mime);

/** Options of {@link createMediaResponder}. */
export type MediaResponderOptions = {
  /** A Media file of the open site by hash (`ProjectSession.readMedia`). */
  readonly readMedia: (hash: string) => Promise<StoredBlob | undefined>;
  /** Makes the WebP preview of an image in the worker; `undefined` if it couldn't. */
  readonly makeThumbnail: (
    data: Uint8Array,
    mimeType: ImageMime,
  ) => Promise<Uint8Array | undefined>;
  readonly cacheSize?: number;
};

const notFound = () => new Response(null, { status: 404 });

function image(data: Uint8Array, type: string): Response {
  // The bytes as they are, not a copy: copying a 50 MB original for every request held up the
  // main thread (R13b). They come from SQLite or the thumbnail worker, never from shared memory.
  return new Response(data as Uint8Array<ArrayBuffer>, {
    headers: {
      "Content-Type": type,
      // The URL names the bytes by their hash, so they never change.
      "Cache-Control": "private, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

/**
 * Answers `webforge-media://thumbnail/<hash>` and `webforge-media://original/<hash>` (1.16), the
 * only way the editor shows Media images: never by file path, and only images of the open site
 * (never its documents). Thumbnails are made once per image and kept in memory, never on disk.
 */
export function createMediaResponder(options: MediaResponderOptions) {
  const cacheSize = options.cacheSize ?? THUMBNAIL_CACHE_SIZE;
  /** Most recently used last; the same bytes make the same thumbnail, so the hash is the key. */
  const thumbnails = new Map<string, Promise<Uint8Array | undefined>>();

  const thumbnailOf = (hash: string, data: Uint8Array, mimeType: ImageMime) => {
    let made = thumbnails.get(hash);
    if (made === undefined) {
      made = options.makeThumbnail(data, mimeType);
      // A failure isn't kept: the next request tries again.
      void made.then((thumbnail) => {
        if (thumbnail === undefined) thumbnails.delete(hash);
      });
    }
    thumbnails.delete(hash);
    thumbnails.set(hash, made);
    for (const oldest of thumbnails.keys()) {
      if (thumbnails.size <= cacheSize) break;
      thumbnails.delete(oldest);
    }
    return made;
  };

  return async (url: string): Promise<Response> => {
    const match = /^webforge-media:\/\/(thumbnail|original)\/([0-9a-f]{64})$/.exec(url);
    const [, kind, hash] = match ?? [];
    if (kind === undefined || hash === undefined) {
      return notFound();
    }
    let blob: StoredBlob | undefined;
    try {
      blob = await options.readMedia(hash);
    } catch {
      // The site closed or its file failed underneath: the image just doesn't show.
      return notFound();
    }
    if (blob === undefined || !isImageMime(blob.mime)) {
      return notFound();
    }
    if (kind === "original") {
      return image(blob.data, blob.mime);
    }
    const thumbnail = await thumbnailOf(hash, blob.data, blob.mime);
    return thumbnail === undefined ? notFound() : image(thumbnail, "image/webp");
  };
}
