import type { IMAGE_MIME_TYPES } from "./media.js";

/**
 * The most pixels an image may have (50 megapixels, e.g. 8660 × 5774). A small file can claim a
 * huge size, and decoding it for thumbnails and the export would exhaust memory: import refuses
 * such an image, and so does every decode of one that came in a site file (S12).
 */
export const MAX_IMAGE_PIXELS = 50_000_000;

/** An image's type and size, read from its first bytes. */
export type SniffedImage = {
  readonly mimeType: (typeof IMAGE_MIME_TYPES)[number];
  readonly width: number;
  readonly height: number;
};

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

const u16 = (bytes: Uint8Array, at: number) => ((bytes[at] ?? 0) << 8) | (bytes[at + 1] ?? 0);
const u32 = (bytes: Uint8Array, at: number) => u16(bytes, at) * 0x10000 + u16(bytes, at + 2);

/** Width and height from a PNG's IHDR chunk, which must come first. */
function pngSize(bytes: Uint8Array): { width: number; height: number } | undefined {
  // Signature (8), chunk length (4), "IHDR" (4), then width and height.
  const ihdr = String.fromCharCode(...bytes.subarray(12, 16));
  return ihdr === "IHDR" ? { width: u32(bytes, 16), height: u32(bytes, 20) } : undefined;
}

/** Start-of-frame markers, which carry the size; C4 (DHT), C8 (JPG) and CC (DAC) are not. */
const JPEG_FRAME_MARKERS = new Set([
  0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
]);

/** Width and height from a JPEG's first start-of-frame segment. */
function jpegSize(bytes: Uint8Array): { width: number; height: number } | undefined {
  let at = 2;
  while (at + 9 < bytes.length) {
    if (bytes[at] !== 0xff) {
      return undefined;
    }
    const marker = bytes[at + 1] ?? 0;
    if (marker === 0xff) {
      // Fill byte before a marker.
      at += 1;
      continue;
    }
    if (JPEG_FRAME_MARKERS.has(marker)) {
      return { height: u16(bytes, at + 5), width: u16(bytes, at + 7) };
    }
    if (marker === 0xd9 || marker === 0xda) {
      // End of image, or the scan began without a frame header.
      return undefined;
    }
    // Every other segment carries its length (which counts itself) after the marker.
    at += 2 + u16(bytes, at + 2);
  }
  return undefined;
}

/**
 * A JPEG's or PNG's type and size from its first bytes, without decoding it; `undefined` for
 * anything else, a truncated header or an image without a size.
 */
export function sniffImage(bytes: Uint8Array): SniffedImage | undefined {
  const size = PNG_SIGNATURE.every((byte, index) => bytes[index] === byte)
    ? { mimeType: "image/png" as const, size: pngSize(bytes) }
    : bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
      ? { mimeType: "image/jpeg" as const, size: jpegSize(bytes) }
      : undefined;
  if (size?.size === undefined || size.size.width <= 0 || size.size.height <= 0) return undefined;
  return { mimeType: size.mimeType, ...size.size };
}

/**
 * Whether `bytes`, stored as an image of type `mimeType`, may be decoded: its header says it is
 * that type, with a size of at most {@link MAX_IMAGE_PIXELS} (S12). Checked before every decode of
 * an image from a site file, which may come from anyone.
 */
export function decodableImage(bytes: Uint8Array, mimeType: string): SniffedImage | undefined {
  const image = sniffImage(bytes);
  return image !== undefined &&
    image.mimeType === mimeType &&
    image.width * image.height <= MAX_IMAGE_PIXELS
    ? image
    : undefined;
}
