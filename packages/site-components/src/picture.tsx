import type { CSSProperties } from "react";
import type { ResolvedImage } from "./schema.js";

/**
 * The inline style that keeps the focal point in view and, on the canvas, shows the crop. Cut to a
 * shape of its own (`shaped`), the image leaves the crop's shape to its classes, as
 * `--picture-ratio`, for the devices it keeps it on.
 */
function pictureStyle(image: ResolvedImage, shaped: boolean): CSSProperties | undefined {
  const crop: Readonly<Record<string, string>> =
    image.aspectRatio === undefined
      ? {}
      : shaped
        ? { "--picture-ratio": image.aspectRatio }
        : { aspectRatio: image.aspectRatio, objectFit: "cover" };
  const style: CSSProperties = {
    ...(image.objectPosition === undefined ? {} : { objectPosition: image.objectPosition }),
    ...crop,
  };
  return Object.keys(style).length === 0 ? undefined : style;
}

/**
 * The shape `image` shows at, its width ÷ its height: its crop's on the canvas, else its own (the
 * export's files are cut to the crop already).
 */
export function pictureRatio(image: ResolvedImage): number {
  const [across, down] = (image.aspectRatio ?? "").split("/").map((part) => Number(part.trim()));
  if (across !== undefined && down !== undefined && across > 0 && down > 0) return across / down;
  return image.height > 0 ? image.width / image.height : 1;
}

/** Props of {@link Picture}. */
export type PictureProps = {
  readonly image: ResolvedImage;
  readonly alt: string;
  /** The `sizes` attribute: how wide the image is shown, e.g. `(min-width: 1024px) 50vw, 100vw`. */
  readonly sizes: string;
  /**
   * The page's first picture, above the fold: loaded at once and first (`fetchpriority="high"`,
   * 3.15, SEO-4), instead of lazily.
   */
  readonly eager?: boolean;
  readonly className?: string;
  /**
   * Its classes cut it to a shape of their own (3.19), the crop's being `--picture-ratio`, where
   * there is one, for the devices that keep it.
   */
  readonly shaped?: boolean;
  /** The image's id, for a link it describes (a Buy button's). */
  readonly id?: string;
};

/**
 * A responsive image: WebP sources with a JPEG/PNG fallback, sized to avoid layout shift (X2). Its
 * focal point keeps the important part in view wherever CSS cuts the image to fit.
 */
export function Picture({
  image,
  alt,
  sizes,
  eager = false,
  className,
  shaped = false,
  id,
}: PictureProps) {
  return (
    <picture>
      {image.sources.map((source) => (
        <source key={source.type} type={source.type} srcSet={source.srcset} sizes={sizes} />
      ))}
      <img
        id={id}
        src={image.src}
        srcSet={image.fallback.srcset}
        sizes={sizes}
        width={image.width}
        height={image.height}
        alt={alt}
        loading={eager ? "eager" : "lazy"}
        {...(eager ? { fetchPriority: "high" } : {})}
        decoding="async"
        className={className}
        style={pictureStyle(image, shaped)}
      />
    </picture>
  );
}
