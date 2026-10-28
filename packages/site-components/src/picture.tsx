import type { CSSProperties } from "react";
import type { ResolvedImage } from "./schema.js";

/** The inline style that keeps the focal point in view and, on the canvas, shows the crop. */
function pictureStyle(image: ResolvedImage): CSSProperties | undefined {
  const style: CSSProperties = {
    ...(image.objectPosition === undefined ? {} : { objectPosition: image.objectPosition }),
    ...(image.aspectRatio === undefined
      ? {}
      : { aspectRatio: image.aspectRatio, objectFit: "cover" }),
  };
  return Object.keys(style).length === 0 ? undefined : style;
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
  /** The image's id, for a link it describes (a Buy button's). */
  readonly id?: string;
};

/**
 * A responsive image: WebP sources with a JPEG/PNG fallback, sized to avoid layout shift (X2). Its
 * focal point keeps the important part in view wherever CSS cuts the image to fit.
 */
export function Picture({ image, alt, sizes, eager = false, className, id }: PictureProps) {
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
        style={pictureStyle(image)}
      />
    </picture>
  );
}
