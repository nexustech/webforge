import decodeJpeg, { init as initJpegDecode } from "@jsquash/jpeg/decode.js";
import encodeJpeg, { init as initJpegEncode } from "@jsquash/jpeg/encode.js";
import decodePng, { init as initPng } from "@jsquash/png/decode.js";
import encodePng from "@jsquash/png/encode.js";
import resize, { initResize } from "@jsquash/resize";
import encodeWebp, { init as initWebpEncode } from "@jsquash/webp/encode.js";
import type { MediaItem } from "@webforge/model";
import type { ImageSource, ResolvedImage } from "@webforge/site-components";
import type { CodecModules } from "./resources.js";

/** Widths exported for each image, never wider than the original (X2). */
const IMAGE_WIDTHS = [640, 1280, 1920] as const;

const WEBP_QUALITY = 80;
const JPEG_QUALITY = 80;

/** The browser's `ImageData`, which jSquash creates and expects. Node has none. */
class NodeImageData {
  readonly data: Uint8ClampedArray;
  readonly width: number;
  readonly height: number;
  readonly colorSpace = "srgb";

  constructor(data: Uint8ClampedArray, width: number, height?: number) {
    this.data = data;
    this.width = width;
    this.height = height ?? data.length / 4 / width;
  }
}

let ready: Promise<void> | null = null;

/** Prepares the codecs once per process. jSquash keeps its modules in module-level state. */
function initCodecs(codecs: CodecModules): Promise<void> {
  ready ??= (async () => {
    if (!("ImageData" in globalThis)) {
      Object.assign(globalThis, { ImageData: NodeImageData });
    }
    await Promise.all([
      initJpegDecode(codecs.jpegDecode),
      initJpegEncode(codecs.jpegEncode),
      initPng(codecs.png),
      initWebpEncode(codecs.webpEncode),
      initResize(codecs.resize),
    ]);
  })();
  return ready;
}

/** One exported image file. */
type ImageFile = { readonly path: string; readonly data: Uint8Array };

/** The files and markup data of one processed image. */
export type ProcessedImage = {
  readonly files: readonly ImageFile[];
  readonly image: ResolvedImage;
};

function hasTransparency(image: ImageData): boolean {
  for (let alpha = 3; alpha < image.data.length; alpha += 4) {
    if (image.data[alpha] !== 255) {
      return true;
    }
  }
  return false;
}

/**
 * Converts an original image into responsive WebP files plus a JPEG fallback (PNG when the image
 * has transparency), at each of {@link IMAGE_WIDTHS} up to the original's width (X2).
 * `assetsUrl` is the path from a page at the site root to `assets/img/`.
 */
export async function processImage(
  item: MediaItem,
  codecs: CodecModules,
  assetsUrl = "assets/img/",
): Promise<ProcessedImage> {
  await initCodecs(codecs);
  // The decoders take an ArrayBuffer; copy so a view into a larger buffer cannot leak extra bytes.
  const bytes = item.data.slice().buffer;
  const original = item.mimeType === "image/png" ? await decodePng(bytes) : await decodeJpeg(bytes);
  const transparent = item.mimeType === "image/png" && hasTransparency(original);
  const fallbackType = transparent ? "image/png" : "image/jpeg";
  const fallbackExtension = transparent ? "png" : "jpg";

  const widths = [
    ...new Set([
      ...IMAGE_WIDTHS.filter((width) => width < original.width),
      Math.min(original.width, IMAGE_WIDTHS.at(-1) ?? original.width),
    ]),
  ].sort((a, b) => a - b);

  const files: ImageFile[] = [];
  const webp: string[] = [];
  const fallback: string[] = [];
  let largest = { width: original.width, height: original.height };
  for (const width of widths) {
    const height = Math.round((original.height * width) / original.width);
    const scaled = width === original.width ? original : await resize(original, { width, height });
    const webpName = `${item.name}-${width}.webp`;
    const fallbackName = `${item.name}-${width}.${fallbackExtension}`;
    files.push({
      path: webpName,
      data: new Uint8Array(await encodeWebp(scaled, { quality: WEBP_QUALITY })),
    });
    files.push({
      path: fallbackName,
      data: new Uint8Array(
        transparent ? await encodePng(scaled) : await encodeJpeg(scaled, { quality: JPEG_QUALITY }),
      ),
    });
    webp.push(`${assetsUrl}${webpName} ${width}w`);
    fallback.push(`${assetsUrl}${fallbackName} ${width}w`);
    largest = { width, height };
  }

  const fallbackSource: ImageSource = { type: fallbackType, srcset: fallback.join(", ") };
  return {
    files,
    image: {
      sources: [{ type: "image/webp", srcset: webp.join(", ") }],
      src: `${assetsUrl}${item.name}-${largest.width}.${fallbackExtension}`,
      fallback: fallbackSource,
      width: largest.width,
      height: largest.height,
    },
  };
}

/** Rewrites an image's URLs for a page `depth` folders below the site root (`../` per level). */
export function imageForDepth(image: ResolvedImage, depth: number): ResolvedImage {
  if (depth === 0) {
    return image;
  }
  const prefix = "../".repeat(depth);
  const relocate = (srcset: string) =>
    srcset
      .split(", ")
      .map((entry) => `${prefix}${entry}`)
      .join(", ");
  return {
    ...image,
    sources: image.sources.map((source) => ({ ...source, srcset: relocate(source.srcset) })),
    src: `${prefix}${image.src}`,
    fallback: { ...image.fallback, srcset: relocate(image.fallback.srcset) },
  };
}
