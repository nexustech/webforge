import decodeJpeg, { init as initJpegDecode } from "@jsquash/jpeg/decode.js";
import encodeJpeg, { init as initJpegEncode } from "@jsquash/jpeg/encode.js";
import decodePng, { init as initPng } from "@jsquash/png/decode.js";
import encodePng from "@jsquash/png/encode.js";
import resize, { initResize } from "@jsquash/resize";
import encodeWebp, { init as initWebpEncode } from "@jsquash/webp/encode.js";
import type { MediaItem } from "@webforge/model";
import type { ImageSource, ResolvedImage } from "@webforge/site-components";
import { z } from "zod";
import type {} from "./codec-globals.js";
import { onceUntilFailure } from "./once.js";
import type { CodecModules, ImageCache } from "./resources.js";

/** Widths exported for each image, never wider than the original (X2). */
const IMAGE_WIDTHS = [640, 1280, 1920] as const;

const WEBP_QUALITY = 80;
export const JPEG_QUALITY = 80;

/** Width of the previews the editor shows of Media images (1.16). */
const THUMBNAIL_WIDTH = 320;

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

/**
 * Gives jSquash the `ImageData` it constructs, where the runtime has none (Node). Only then:
 * a browser's own is never replaced, and nothing else on the global changes.
 */
function provideImageData(): void {
  if (!("ImageData" in globalThis)) {
    Object.defineProperty(globalThis, "ImageData", {
      value: NodeImageData,
      configurable: true,
      writable: true,
    });
  }
}

let prepare: (() => Promise<void>) | undefined;

/**
 * Prepares the codecs once per process: jSquash keeps its modules in module-level state. A failed
 * preparation isn't kept, so the next image tries again (R15).
 */
export function initCodecs(codecs: CodecModules): Promise<void> {
  prepare ??= onceUntilFailure(async () => {
    provideImageData();
    await Promise.all([
      initJpegDecode(codecs.jpegDecode),
      initJpegEncode(codecs.jpegEncode),
      initPng(codecs.png),
      initWebpEncode(codecs.webpEncode),
      initResize(codecs.resize),
    ]);
  });
  return prepare();
}

/** Decodes an original JPEG or PNG. */
export function decodeOriginal(
  data: Uint8Array,
  mimeType: MediaItem["mimeType"],
): Promise<ImageData> {
  // The decoders take an ArrayBuffer; copy so a view into a larger buffer cannot leak extra bytes.
  const bytes = data.slice().buffer;
  return mimeType === "image/png" ? decodePng(bytes) : decodeJpeg(bytes);
}

/**
 * A small WebP preview of an original image, {@link THUMBNAIL_WIDTH} pixels wide (or the
 * original's width, if narrower), for the editor's Media panel and image field.
 */
export async function makeThumbnail(
  data: Uint8Array,
  mimeType: MediaItem["mimeType"],
  codecs: CodecModules,
): Promise<Uint8Array> {
  await initCodecs(codecs);
  const original = await decodeOriginal(data, mimeType);
  const width = Math.min(THUMBNAIL_WIDTH, original.width);
  const height = Math.max(1, Math.round((original.height * width) / original.width));
  const scaled = width === original.width ? original : await resize(original, { width, height });
  return new Uint8Array(await encodeWebp(scaled, { quality: WEBP_QUALITY }));
}

/** The part of `image` inside `crop` (fractions of it), as a new image; at least 1 × 1 pixel. */
export function cropPixels(image: ImageData, crop: NonNullable<MediaItem["crop"]>): ImageData {
  const x = Math.min(Math.round(crop.x * image.width), image.width - 1);
  const y = Math.min(Math.round(crop.y * image.height), image.height - 1);
  const width = Math.max(1, Math.min(Math.round(crop.width * image.width), image.width - x));
  const height = Math.max(1, Math.min(Math.round(crop.height * image.height), image.height - y));
  const data = new Uint8ClampedArray(width * height * 4);
  for (let row = 0; row < height; row++) {
    const start = ((y + row) * image.width + x) * 4;
    data.set(image.data.subarray(start, start + width * 4), row * width * 4);
  }
  return new ImageData(data, width, height);
}

/**
 * The focal point as CSS `object-position`, measured in the exported (cropped) image: e.g.
 * `30% 50%`. `undefined` without a focal point, so the browser's centre applies.
 */
function objectPositionOf(item: MediaItem): string | undefined {
  if (item.focal === undefined) {
    return undefined;
  }
  const crop = item.crop ?? { x: 0, y: 0, width: 1, height: 1 };
  const percent = (point: number, start: number, size: number) =>
    Math.round(Math.min(Math.max((point - start) / size, 0), 1) * 100);
  return `${percent(item.focal.x, crop.x, crop.width)}% ${percent(item.focal.y, crop.y, crop.height)}%`;
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
 * What an image's encoding depends on besides the original: change any setting here and every
 * cached image is encoded again.
 */
const ENCODING = `webp${WEBP_QUALITY}-jpeg${JPEG_QUALITY}-widths${IMAGE_WIDTHS.join(".")}`;

/** The cut-to-crop size of an image, and whether its fallback is a PNG for its transparency. */
const planSchema = z.strictObject({
  width: z.int().positive(),
  height: z.int().positive(),
  transparent: z.boolean(),
});
type Plan = z.infer<typeof planSchema>;

/** The original of an image to process: its SHA-256, and its bytes, read only when needed. */
export type ImageOriginal = {
  readonly hash: string;
  readonly read: () => Promise<Uint8Array | undefined>;
};

/** `item`'s crop as a cache key part: `whole` without one. */
export function cropKey(item: MediaItem): string {
  return item.crop === undefined
    ? "whole"
    : [item.crop.x, item.crop.y, item.crop.width, item.crop.height]
        .map((value) => value.toFixed(6))
        .join(",");
}

/** The cache key of `item`'s `part`: its plan, or one width in one format. */
function cacheKey(original: ImageOriginal, item: MediaItem, part: string): string {
  return `${ENCODING}/${original.hash}/${cropKey(item)}/${part}`;
}

/** The widths an image of `plan`'s size is exported at, smallest first (X2). */
function widthsFor(plan: Plan): number[] {
  return [
    ...new Set([
      ...IMAGE_WIDTHS.filter((width) => width < plan.width),
      Math.min(plan.width, IMAGE_WIDTHS.at(-1) ?? plan.width),
    ]),
  ].sort((a, b) => a - b);
}

/** One encoded width: its WebP and its fallback. */
type Encoded = {
  readonly width: number;
  readonly height: number;
  readonly webp: Uint8Array;
  readonly fallback: Uint8Array;
};

/** An image's plan and encodings. */
type Encodings = { readonly plan: Plan; readonly encoded: readonly Encoded[] };

/** The extension of an image's fallback files. */
const fallbackExtensionOf = (plan: Plan) => (plan.transparent ? "png" : "jpg");

/** `item`'s encodings from `cache`, or `undefined` unless every one is there. */
async function fromCache(
  cache: ImageCache,
  original: ImageOriginal,
  item: MediaItem,
): Promise<Encodings | undefined> {
  const stored = await cache.get(cacheKey(original, item, "plan"));
  if (stored === undefined) return undefined;
  let plan: Plan;
  try {
    const parsed = planSchema.safeParse(JSON.parse(new TextDecoder().decode(stored)));
    if (!parsed.success) return undefined;
    plan = parsed.data;
  } catch {
    return undefined;
  }
  const encoded: Encoded[] = [];
  for (const width of widthsFor(plan)) {
    const webp = await cache.get(cacheKey(original, item, `${width}.webp`));
    const fallback = await cache.get(
      cacheKey(original, item, `${width}.${fallbackExtensionOf(plan)}`),
    );
    if (webp === undefined || fallback === undefined) return undefined;
    encoded.push({ width, height: Math.round((plan.height * width) / plan.width), webp, fallback });
  }
  return { plan, encoded };
}

/** Decodes, crops and encodes `data` at every width. */
async function encode(data: Uint8Array, item: MediaItem): Promise<Encodings> {
  const decoded = await decodeOriginal(data, item.mimeType);
  // The crop is cut before resizing, so every width shows the same part of the image (G14).
  const original = item.crop === undefined ? decoded : cropPixels(decoded, item.crop);
  const plan: Plan = {
    width: original.width,
    height: original.height,
    transparent: item.mimeType === "image/png" && hasTransparency(original),
  };
  const encoded: Encoded[] = [];
  for (const width of widthsFor(plan)) {
    const height = Math.round((original.height * width) / original.width);
    const scaled = width === original.width ? original : await resize(original, { width, height });
    encoded.push({
      width,
      height,
      webp: new Uint8Array(await encodeWebp(scaled, { quality: WEBP_QUALITY })),
      fallback: new Uint8Array(
        plan.transparent
          ? await encodePng(scaled)
          : await encodeJpeg(scaled, { quality: JPEG_QUALITY }),
      ),
    });
  }
  return { plan, encoded };
}

/** Keeps `item`'s encodings in `cache`, the plan last: a plan is only there with all its files. */
async function remember(
  cache: ImageCache,
  original: ImageOriginal,
  item: MediaItem,
  { plan, encoded }: Encodings,
): Promise<void> {
  for (const { width, webp, fallback } of encoded) {
    await cache.set(cacheKey(original, item, `${width}.webp`), webp);
    await cache.set(cacheKey(original, item, `${width}.${fallbackExtensionOf(plan)}`), fallback);
  }
  await cache.set(cacheKey(original, item, "plan"), new TextEncoder().encode(JSON.stringify(plan)));
}

/**
 * Converts an original image into responsive WebP files plus a JPEG fallback (PNG when the image
 * has transparency), at each of {@link IMAGE_WIDTHS} up to the original's width (X2), cut to the
 * image's crop first. The result carries the image's alt text and its focal point.
 * `assetsUrl` is the path from a page at the site root to `assets/img/`.
 *
 * With a `cache`, an image encoded before (the same original, crop and settings) comes from it:
 * its bytes aren't read and nothing is encoded (R15). `undefined` if the original can't be read.
 */
export async function processImage(
  item: MediaItem,
  original: ImageOriginal,
  codecs: CodecModules,
  options: { readonly cache?: ImageCache | undefined; readonly assetsUrl?: string } = {},
): Promise<ProcessedImage | undefined> {
  const assetsUrl = options.assetsUrl ?? "assets/img/";
  let encodings =
    options.cache === undefined ? undefined : await fromCache(options.cache, original, item);
  if (encodings === undefined) {
    const data = await original.read();
    if (data === undefined) return undefined;
    await initCodecs(codecs);
    encodings = await encode(data, item);
    if (options.cache !== undefined) await remember(options.cache, original, item, encodings);
  }

  const { plan, encoded } = encodings;
  const files = encoded.flatMap((entry) => [
    { path: fileNameOf(item, entry.width, "webp"), data: entry.webp },
    { path: fileNameOf(item, entry.width, fallbackExtensionOf(plan)), data: entry.fallback },
  ]);
  return { files, image: resolvedImage(item, plan, encoded, assetsUrl) };
}

/** An exported image file's name: `cakes-800.webp`. */
const fileNameOf = (item: MediaItem, width: number, extension: string) =>
  `${item.name}-${width}.${extension}`;

/**
 * `item` as pages place it, from its plan and the sizes it's exported at (smallest first): a WebP
 * source and a JPEG or PNG fallback, each with every width, under `assetsUrl`.
 */
function resolvedImage(
  item: MediaItem,
  plan: Plan,
  sizes: readonly { readonly width: number; readonly height: number }[],
  assetsUrl: string,
): ResolvedImage {
  const fallbackExtension = fallbackExtensionOf(plan);
  const srcset = (extension: string) =>
    sizes
      .map(({ width }) => `${assetsUrl}${fileNameOf(item, width, extension)} ${width}w`)
      .join(", ");
  const largest = sizes.at(-1) ?? plan;
  const fallback: ImageSource = {
    type: plan.transparent ? "image/png" : "image/jpeg",
    srcset: srcset(fallbackExtension),
  };
  const objectPosition = objectPositionOf(item);
  return {
    sources: [{ type: "image/webp", srcset: srcset("webp") }],
    src: `${assetsUrl}${fileNameOf(item, largest.width, fallbackExtension)}`,
    fallback,
    width: largest.width,
    height: largest.height,
    alt: item.alt ?? "",
    ...(objectPosition === undefined ? {} : { objectPosition }),
  };
}

/**
 * `item` as the export names and sizes it, worked out from its size in Media (`size`, before any
 * crop) rather than from its pixels, so nothing is read or encoded: what Advanced mode's CSS tab
 * shows (3.14). The crop and widths are the export's own; only the fallback's type is assumed, as
 * the export tells it from the pixels: a PNG's is taken to be a PNG, for its transparency, where an
 * opaque one is exported with a JPEG.
 */
export function plannedImage(
  item: MediaItem,
  size: { readonly width: number; readonly height: number },
  assetsUrl = "assets/img/",
): ResolvedImage {
  // As `cropPixels` cuts it.
  const crop = item.crop ?? { x: 0, y: 0, width: 1, height: 1 };
  const x = Math.min(Math.round(crop.x * size.width), size.width - 1);
  const y = Math.min(Math.round(crop.y * size.height), size.height - 1);
  const plan: Plan = {
    width: Math.max(1, Math.min(Math.round(crop.width * size.width), size.width - x)),
    height: Math.max(1, Math.min(Math.round(crop.height * size.height), size.height - y)),
    transparent: item.mimeType === "image/png",
  };
  const sizes = widthsFor(plan).map((width) => ({
    width,
    height: Math.round((plan.height * width) / plan.width),
  }));
  return resolvedImage(item, plan, sizes, assetsUrl);
}

/**
 * Rewrites an image's URLs for a page `prefix` away from the site root: `../` per folder level, or
 * the root itself for the "Page not found" page (`/` or the web address, F-ED-20).
 */
export function imageAt(image: ResolvedImage, prefix: string): ResolvedImage {
  if (prefix === "") {
    return image;
  }
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
