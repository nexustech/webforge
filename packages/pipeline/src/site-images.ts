import encodeJpeg from "@jsquash/jpeg/encode.js";
import encodePng from "@jsquash/png/encode.js";
import resize from "@jsquash/resize";
import type { MediaItem } from "@webforge/model";
import {
  cropKey,
  cropPixels,
  decodeOriginal,
  type ImageOriginal,
  initCodecs,
  JPEG_QUALITY,
} from "./images.js";
import type { CodecModules, ImageCache } from "./resources.js";

/**
 * The site's own images besides its pages' (3.4, F-EX-2): the favicon and app icons from Site
 * Settings' icon, and the picture shown when a page is shared, both cut from one Media image.
 */

/** One file the export writes. */
type SiteImageFile = { readonly path: string; readonly data: Uint8Array };

/** The square icons, as PNG: Apple's home-screen icon, and the web app manifest's two (3.5). */
const ICONS = [
  { path: "apple-touch-icon.png", size: 180 },
  { path: "assets/icons/icon-192.png", size: 192 },
  { path: "assets/icons/icon-512.png", size: 512 },
] as const;

/** The sizes `favicon.ico` holds, each a PNG inside it, as every current browser reads. */
const ICO_SIZES = [16, 32, 48] as const;

/** The picture social networks show for a shared page: 1.91 : 1, at most 1200 × 630. */
const SHARE_WIDTH = 1200;
const SHARE_HEIGHT = 630;

/** What the cache keys say of these encodings, so a change to them never reuses old files. */
const ICON_ENCODING = `icons-png-${ICONS.map((icon) => icon.size).join(".")}-ico${ICO_SIZES.join(".")}`;
const SHARE_ENCODING = `share-jpeg${JPEG_QUALITY}-${SHARE_WIDTH}x${SHARE_HEIGHT}`;

/** The focal point within `item`'s crop, as fractions of it; the middle without one. */
function focalInCrop(item: MediaItem): { readonly x: number; readonly y: number } {
  if (item.focal === undefined) return { x: 0.5, y: 0.5 };
  const crop = item.crop ?? { x: 0, y: 0, width: 1, height: 1 };
  const within = (point: number, start: number, size: number) =>
    Math.min(Math.max((point - start) / size, 0), 1);
  return {
    x: within(item.focal.x, crop.x, crop.width),
    y: within(item.focal.y, crop.y, crop.height),
  };
}

/**
 * The largest part of `image` with `aspect` (width ÷ height), centred on the focal point as far as
 * the edges allow: how CSS's `object-fit: cover` would cut it.
 */
function coverCrop(
  image: ImageData,
  aspect: number,
  focal: { readonly x: number; readonly y: number },
): ImageData {
  const width = Math.min(image.width, Math.round(image.height * aspect));
  const height = Math.min(image.height, Math.round(image.width / aspect));
  const left = Math.min(Math.max(focal.x * image.width - width / 2, 0), image.width - width);
  const top = Math.min(Math.max(focal.y * image.height - height / 2, 0), image.height - height);
  return cropPixels(image, {
    x: left / image.width,
    y: top / image.height,
    width: width / image.width,
    height: height / image.height,
  });
}

/** `image` at `width` × `height`; the same image when it's that size already. */
const scaled = (image: ImageData, width: number, height: number) =>
  image.width === width && image.height === height ? image : resize(image, { width, height });

/** `image` laid over white: a JPEG has no transparency, and black would show through. */
function onWhite(image: ImageData): ImageData {
  const data = new Uint8ClampedArray(image.data);
  for (let at = 0; at < data.length; at += 4) {
    const alpha = (data[at + 3] ?? 255) / 255;
    for (let channel = 0; channel < 3; channel++) {
      data[at + channel] = Math.round((data[at + channel] ?? 0) * alpha + 255 * (1 - alpha));
    }
    data[at + 3] = 255;
  }
  return new ImageData(data, image.width, image.height);
}

/** An `.ico` holding `images` (PNG files, square, at most 256 pixels), as browsers read one. */
function icoOf(images: readonly { readonly size: number; readonly png: Uint8Array }[]): Uint8Array {
  const header = 6;
  const entry = 16;
  let offset = header + entry * images.length;
  const bytes = new Uint8Array(offset + images.reduce((sum, image) => sum + image.png.length, 0));
  const view = new DataView(bytes.buffer);
  view.setUint16(2, 1, true); // An icon, not a cursor.
  view.setUint16(4, images.length, true);
  images.forEach((image, index) => {
    const at = header + entry * index;
    // A width and height of 0 mean 256.
    view.setUint8(at, image.size >= 256 ? 0 : image.size);
    view.setUint8(at + 1, image.size >= 256 ? 0 : image.size);
    view.setUint16(at + 4, 1, true); // Colour planes.
    view.setUint16(at + 6, 32, true); // Bits per pixel.
    view.setUint32(at + 8, image.png.length, true);
    view.setUint32(at + 12, offset, true);
    bytes.set(image.png, offset);
    offset += image.png.length;
  });
  return bytes;
}

/**
 * The files of `parts`, from `cache` when every one is there, else made by `make` and kept. The
 * original is then neither read nor decoded (R15). A part's key names the original's SHA-256, its
 * crop, its focal point and the encoding, so a key never stands for other bytes.
 */
async function cachedFiles(
  cache: ImageCache | undefined,
  keyOf: (path: string) => string,
  paths: readonly string[],
  make: () => Promise<readonly SiteImageFile[] | undefined>,
): Promise<readonly SiteImageFile[] | undefined> {
  if (cache !== undefined && paths.length > 0) {
    const found = await Promise.all(paths.map((path) => cache.get(keyOf(path))));
    if (found.every((data) => data !== undefined)) {
      return paths.map((path, at) => ({ path, data: found[at] ?? new Uint8Array() }));
    }
  }
  const files = await make();
  if (files !== undefined && cache !== undefined) {
    for (const file of files) await cache.set(keyOf(file.path), file.data);
  }
  return files;
}

/** The image `item` names, decoded and cut to its crop; `undefined` when the site lacks it. */
async function decoded(
  item: MediaItem,
  original: ImageOriginal,
  codecs: CodecModules,
): Promise<ImageData | undefined> {
  const data = await original.read();
  if (data === undefined) return undefined;
  await initCodecs(codecs);
  const image = await decodeOriginal(data, item.mimeType);
  return item.crop === undefined ? image : cropPixels(image, item.crop);
}

const focalKey = (item: MediaItem) => {
  const focal = focalInCrop(item);
  return `${focal.x.toFixed(6)},${focal.y.toFixed(6)}`;
};

/**
 * The favicon set from `item`, Site Settings' icon (3.4): cut square around its focal point, as
 * `favicon.ico` (16, 32 and 48 pixels) and PNGs for Apple's home screen (180) and the web app
 * manifest (192, 512). An image is never made larger (X2): a size the cut is smaller than is left
 * out. Kept in `cache`; `undefined` when the site no longer stores the image.
 */
export async function iconFiles(
  item: MediaItem,
  original: ImageOriginal,
  codecs: CodecModules,
  cache: ImageCache | undefined,
): Promise<readonly SiteImageFile[] | undefined> {
  const keyOf = (path: string) =>
    `${ICON_ENCODING}/${original.hash}/${cropKey(item)}/${focalKey(item)}/${path}`;
  // The sizes the image allows, known from its plan once it has been made.
  const planKey = keyOf("plan");
  const plan = await cache?.get(planKey);
  const paths = plan === undefined ? [] : new TextDecoder().decode(plan).split("\n");
  const files = await cachedFiles(cache, keyOf, paths, async () => {
    const image = await decoded(item, original, codecs);
    if (image === undefined) return undefined;
    const square = coverCrop(image, 1, focalInCrop(item));
    const made: SiteImageFile[] = [];
    const ico: { size: number; png: Uint8Array }[] = [];
    for (const size of ICO_SIZES.filter((each) => each <= square.width)) {
      ico.push({ size, png: new Uint8Array(await encodePng(await scaled(square, size, size))) });
    }
    if (ico.length > 0) made.push({ path: "favicon.ico", data: icoOf(ico) });
    for (const icon of ICONS.filter((each) => each.size <= square.width)) {
      const png = await encodePng(await scaled(square, icon.size, icon.size));
      made.push({ path: icon.path, data: new Uint8Array(png) });
    }
    return made;
  });
  // The plan last, so it's only ever there with all its files.
  if (files !== undefined && plan === undefined && cache !== undefined) {
    await cache.set(planKey, new TextEncoder().encode(files.map((file) => file.path).join("\n")));
  }
  return files;
}

/**
 * The picture shown when a page is shared (3.4, `og:image`): `item` cut to 1.91 : 1 around its
 * focal point, as a JPEG at most 1200 × 630 (never larger than the cut), on white where it was
 * transparent. Kept in `cache`; `undefined` when the site no longer stores the image.
 */
export async function shareImageFile(
  item: MediaItem,
  original: ImageOriginal,
  codecs: CodecModules,
  cache: ImageCache | undefined,
): Promise<SiteImageFile | undefined> {
  const path = `assets/img/${item.name}-share.jpg`;
  const keyOf = (file: string) =>
    `${SHARE_ENCODING}/${original.hash}/${cropKey(item)}/${focalKey(item)}/${file}`;
  const files = await cachedFiles(cache, keyOf, [path], async () => {
    const image = await decoded(item, original, codecs);
    if (image === undefined) return undefined;
    const cut = coverCrop(image, SHARE_WIDTH / SHARE_HEIGHT, focalInCrop(item));
    const width = Math.min(SHARE_WIDTH, cut.width);
    const height = Math.max(1, Math.round((width * cut.height) / cut.width));
    const jpeg = await encodeJpeg(onWhite(await scaled(cut, width, height)), {
      quality: JPEG_QUALITY,
    });
    return [{ path, data: new Uint8Array(jpeg) }];
  });
  return files?.[0];
}
