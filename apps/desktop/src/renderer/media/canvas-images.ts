import type { CanvasEngine } from "@webforge/engine";
import { t } from "@webforge/i18n";
import { type ImageMeta, isImageMeta, type SiteDoc } from "@webforge/model";
import type { ResolvedImage } from "@webforge/site-components";
import { mediaImageUrl } from "../../shared/ipc/media.js";

type Unsubscribe = () => void;

const percent = (fraction: number) => `${Math.round(fraction * 1000) / 10}%`;

/**
 * Where a Media image shows on the canvas: its original through the `webforge-media:` scheme, at
 * its size, with its alt text. A crop shows as the crop's shape cut to fit around where the crop
 * sits (exact for the Media panel's presets, which keep a full side); without one, the focal point.
 */
export function canvasImage(
  item: ImageMeta,
  url: (item: ImageMeta, size: "original") => string = mediaImageUrl,
): ResolvedImage {
  const src = url(item, "original");
  const base = {
    sources: [],
    src,
    fallback: { type: item.mimeType, srcset: `${src} ${item.width}w` },
    width: item.width,
    height: item.height,
    alt: item.alt,
  };
  const { crop, focal } = item;
  if (crop === undefined) {
    return focal === undefined
      ? base
      : { ...base, objectPosition: `${percent(focal.x)} ${percent(focal.y)}` };
  }
  // object-position p% lines the image's p% point up with the box's: for a crop starting at x of a
  // free span 1 - width, that is x / (1 - width).
  const along = (start: number, size: number, fallback: number) =>
    size >= 1 ? fallback : start / (1 - size);
  const width = Math.round(crop.width * item.width);
  const height = Math.round(crop.height * item.height);
  return {
    ...base,
    width,
    height,
    aspectRatio: `${width} / ${height}`,
    objectPosition: `${percent(along(crop.x, crop.width, focal?.x ?? 0.5))} ${percent(
      along(crop.y, crop.height, focal?.y ?? 0.5),
    )}`,
  };
}

/** A grey box with a crossed-out picture: no text, so it reads the same in every language. */
const REMOVED_IMAGE_SVG = [
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300">',
  '<rect width="400" height="300" fill="#e5e7eb"/>',
  '<g fill="none" stroke="#9ca3af" stroke-width="8" stroke-linecap="round" stroke-linejoin="round">',
  '<rect x="140" y="105" width="120" height="90" rx="8"/>',
  '<path d="M150 185l35-35 25 25 15-15 25 25"/><path d="M130 95l140 110"/>',
  "</g></svg>",
].join("");
const REMOVED_IMAGE_URL = `data:image/svg+xml,${encodeURIComponent(REMOVED_IMAGE_SVG)}`;

/**
 * What the canvas shows where an image deleted from Media is still placed (1.16): a placeholder,
 * so the place is visible and can be given another image. The export leaves such places out.
 */
function removedImage(): ResolvedImage {
  return {
    sources: [],
    src: REMOVED_IMAGE_URL,
    fallback: { type: "image/png", srcset: "" },
    width: 400,
    height: 300,
    alt: t("site.media.removedImage"),
  };
}

/** The canvas's image resolver for `media`. */
function resolverFor(media: SiteDoc["media"]) {
  return (mediaId: string) => {
    const item = media[mediaId as keyof typeof media];
    if (item === undefined) return removedImage();
    return isImageMeta(item) ? canvasImage(item) : null;
  };
}

/** How long Media must stay unchanged before the canvas is drawn again, e.g. while alt text is typed. */
const REDRAW_DELAY_MS = 150;

/**
 * Shows the site's Media images on the canvas (1.16) and draws the page again once Media has
 * changed and then settled for {@link REDRAW_DELAY_MS}: an image added, replaced, cropped or
 * described anew. Drawing the page again is one setData for the whole page, so typing doesn't
 * redraw it for every key.
 */
export function connectCanvasImages(
  engine: Pick<CanvasEngine, "setImages">,
  session: {
    readonly history: {
      readonly document: {
        getState(): SiteDoc;
        subscribe(listener: (site: SiteDoc) => void): Unsubscribe;
      };
    };
  },
  delayMs = REDRAW_DELAY_MS,
): Unsubscribe {
  let shown = session.history.document.getState().media;
  let timer: ReturnType<typeof setTimeout> | undefined;
  engine.setImages(resolverFor(shown));
  const unsubscribe = session.history.document.subscribe(() => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      const media = session.history.document.getState().media;
      if (media !== shown) {
        shown = media;
        engine.setImages(resolverFor(shown));
      }
    }, delayMs);
  });
  return () => {
    clearTimeout(timer);
    unsubscribe();
  };
}
