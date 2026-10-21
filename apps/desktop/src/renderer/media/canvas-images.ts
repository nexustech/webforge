import type { CanvasEngine } from "@webforge/engine";
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

/** The canvas's image resolver for `media`. */
function resolverFor(media: SiteDoc["media"]) {
  return (mediaId: string) => {
    const item = media[mediaId as keyof typeof media];
    return item !== undefined && isImageMeta(item) ? canvasImage(item) : null;
  };
}

/**
 * Shows the site's Media images on the canvas (1.16) and draws the page again whenever Media
 * changes: an image added, replaced, cropped or described anew.
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
): Unsubscribe {
  let shown = session.history.document.getState().media;
  engine.setImages(resolverFor(shown));
  return session.history.document.subscribe((site) => {
    if (site.media !== shown) {
      shown = site.media;
      engine.setImages(resolverFor(shown));
    }
  });
}
