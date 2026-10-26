import type { ImageCache } from "./resources.js";

/**
 * An {@link ImageCache} in memory, holding at most `maxBytes` of encoded images: past that, those
 * used longest ago go first. Nothing is kept on disk, so a site's images never outlive it there
 * (R13d); the build worker keeps one while the site is open and drops it when the site closes
 * (R15). An image larger than `maxBytes` isn't kept.
 */
export function createMemoryImageCache(maxBytes: number): ImageCache & { readonly bytes: number } {
  // A Map keeps insertion order: re-inserting on use makes its first key the least recently used.
  const entries = new Map<string, Uint8Array>();
  let bytes = 0;
  return {
    get bytes() {
      return bytes;
    },
    async get(key) {
      const data = entries.get(key);
      if (data !== undefined) {
        entries.delete(key);
        entries.set(key, data);
      }
      return data;
    },
    async set(key, data) {
      const previous = entries.get(key);
      if (previous !== undefined) {
        entries.delete(key);
        bytes -= previous.byteLength;
      }
      if (data.byteLength > maxBytes) return;
      entries.set(key, data);
      bytes += data.byteLength;
      for (const [oldest, kept] of entries) {
        if (bytes <= maxBytes) break;
        entries.delete(oldest);
        bytes -= kept.byteLength;
      }
    },
  };
}
