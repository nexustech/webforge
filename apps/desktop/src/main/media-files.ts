import type { FILE_MIME_TYPES, IMAGE_MIME_TYPES } from "@webforge/model";

/** What an imported file turned out to be, from its bytes rather than its name. */
export type SniffedMedia =
  | {
      readonly kind: "image";
      readonly mimeType: (typeof IMAGE_MIME_TYPES)[number];
      readonly width: number;
      readonly height: number;
    }
  | { readonly kind: "file"; readonly mimeType: (typeof FILE_MIME_TYPES)[number] };

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const PDF_SIGNATURE = [0x25, 0x50, 0x44, 0x46, 0x2d]; // %PDF-

function startsWith(bytes: Uint8Array, signature: readonly number[]): boolean {
  return signature.every((byte, index) => bytes[index] === byte);
}

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
 * Recognises the files Media accepts by their first bytes: JPEG and PNG images, with their size,
 * and PDF documents. Anything else, a truncated header or an image without a size, is
 * `undefined`. The file name's extension is never trusted.
 */
export function sniffMedia(bytes: Uint8Array): SniffedMedia | undefined {
  if (startsWith(bytes, PNG_SIGNATURE)) {
    const size = pngSize(bytes);
    return size !== undefined && size.width > 0 && size.height > 0
      ? { kind: "image", mimeType: "image/png", ...size }
      : undefined;
  }
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    const size = jpegSize(bytes);
    return size !== undefined && size.width > 0 && size.height > 0
      ? { kind: "image", mimeType: "image/jpeg", ...size }
      : undefined;
  }
  if (startsWith(bytes, PDF_SIGNATURE)) {
    return { kind: "file", mimeType: "application/pdf" };
  }
  return undefined;
}
