import type { ResolvedImage } from "./library.js";

/** Props of {@link Picture}. */
export type PictureProps = {
  readonly image: ResolvedImage;
  readonly alt: string;
  /** The `sizes` attribute: how wide the image is shown, e.g. `(min-width: 1024px) 50vw, 100vw`. */
  readonly sizes: string;
  /** Load immediately (above the fold) instead of lazily. */
  readonly eager?: boolean;
  readonly className?: string;
};

/** A responsive image: WebP sources with a JPEG/PNG fallback, sized to avoid layout shift (X2). */
export function Picture({ image, alt, sizes, eager = false, className }: PictureProps) {
  return (
    <picture>
      {image.sources.map((source) => (
        <source key={source.type} type={source.type} srcSet={source.srcset} sizes={sizes} />
      ))}
      <img
        src={image.src}
        srcSet={image.fallback.srcset}
        sizes={sizes}
        width={image.width}
        height={image.height}
        alt={alt}
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        className={className}
      />
    </picture>
  );
}
