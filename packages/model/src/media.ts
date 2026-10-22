import { z } from "zod";
import { mediaIdSchema } from "./ids.js";

/** Image types Media accepts; the export makes WebP plus a fallback in the original type (X2). */
export const IMAGE_MIME_TYPES = ["image/jpeg", "image/png"] as const;
/**
 * Documents Media takes besides images (F-ED-24): PDF, Word, Excel, PowerPoint, OpenDocument, plain
 * text and CSV. A link can point at one (F-ED-18 "File"); they are never opened in the editor, and
 * the export copies them unchanged.
 */
export const FILE_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.oasis.opendocument.text",
  "application/vnd.oasis.opendocument.spreadsheet",
  "application/vnd.oasis.opendocument.presentation",
  "text/plain",
  "text/csv",
] as const;

/** A document type Media takes. */
export type FileMimeType = (typeof FILE_MIME_TYPES)[number];

/**
 * The file extension each document type comes with, lower case, without the dot: an import must
 * have it (as well as the content), and the export names the file with it.
 */
export const DOCUMENT_EXTENSIONS: Readonly<Record<FileMimeType, string>> = {
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.ms-powerpoint": "ppt",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
  "application/vnd.oasis.opendocument.text": "odt",
  "application/vnd.oasis.opendocument.spreadsheet": "ods",
  "application/vnd.oasis.opendocument.presentation": "odp",
  "text/plain": "txt",
  "text/csv": "csv",
};

const fraction = z.number().min(0).max(1);

/** A point on an image as fractions of its width and height; `{x: 0.5, y: 0.5}` is the centre. */
export const focalPointSchema = z.strictObject({ x: fraction, y: fraction });

/** The part of an image to show, as fractions of the original's width and height. */
export const cropSchema = z
  .strictObject({
    x: fraction,
    y: fraction,
    width: z.number().gt(0).max(1),
    height: z.number().gt(0).max(1),
  })
  .refine((crop) => crop.x + crop.width <= 1 && crop.y + crop.height <= 1, {
    message: "The crop reaches outside the image",
  });

/** Base name of exported files: `hero` → `assets/img/hero-640.webp`. Unique within a site. */
export const mediaNameSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

/** The name the file had on the user's computer, e.g. `shop.jpg`; shown in the Media panel. */
const fileNameSchema = z
  .string()
  .min(1)
  .max(255)
  .regex(/^[^/\\]+$/);

const blobHashSchema = z.string().regex(/^[0-9a-f]{64}$/);

const mediaBaseShape = {
  id: mediaIdSchema,
  /** SHA-256 of the original bytes, stored unmodified as a blob (X2). Replace changes it. */
  hash: blobHashSchema,
  name: mediaNameSchema,
  fileName: fileNameSchema,
};

const imageMetaSchema = z.strictObject({
  ...mediaBaseShape,
  kind: z.literal("image"),
  mimeType: z.enum(IMAGE_MIME_TYPES),
  width: z.int().positive(),
  height: z.int().positive(),
  /** Alt text, reused wherever the image is placed (G15). Empty means not written yet. */
  alt: z.string(),
  /** Kept in view when a device view crops the image (`object-position`, G14). */
  focal: focalPointSchema.optional(),
  crop: cropSchema.optional(),
});

const fileMetaSchema = z.strictObject({
  ...mediaBaseShape,
  kind: z.literal("file"),
  mimeType: z.enum(FILE_MIME_TYPES),
  /**
   * The file's size in bytes, for the Media panel and Site Check's tip on large downloads. Files
   * imported before 1.28 (PDFs only) don't have it.
   */
  size: z.int().nonnegative().optional(),
});

/**
 * An item in the site's Media: an image or a downloadable file. The bytes live in the `.wforge`
 * blob store; this metadata lives in the site document, so editing alt text, the focal point or the
 * crop is undoable.
 */
export const mediaMetaSchema = z.discriminatedUnion("kind", [imageMetaSchema, fileMetaSchema]);

/** See {@link mediaMetaSchema}. */
export type MediaMeta = z.infer<typeof mediaMetaSchema>;
/** An image in Media. */
export type ImageMeta = z.infer<typeof imageMetaSchema>;
/** A downloadable file in Media. */
export type FileMeta = z.infer<typeof fileMetaSchema>;

/**
 * An image field's value: which Media image to show, and alt text for this placement only. Without
 * an override the image's own alt text applies (G15).
 */
export const imageValueSchema = z.strictObject({
  mediaId: mediaIdSchema,
  alt: z.string().optional(),
});

/** See {@link imageValueSchema}. */
export type ImageValue = z.infer<typeof imageValueSchema>;

/** The alt text a placement shows: its own override, or the image's alt text from Media. */
export function altTextFor(value: ImageValue, media: ImageMeta | undefined): string {
  return value.alt ?? media?.alt ?? "";
}

/** The longest {@link mediaNameSchema} name {@link mediaNameFor} makes, before any `-2`. */
const MAX_MEDIA_NAME = 60;

/**
 * A Media name for an imported file that no other item in `taken` has: the file name without its
 * extension, lower-case, with anything but letters and digits turned into single hyphens
 * (`Shop Front (1).JPG` → `shop-front-1`), then `-2`, `-3`… if needed. A name with no usable
 * letters becomes `image` or `file`.
 */
export function mediaNameFor(
  fileName: string,
  kind: MediaMeta["kind"],
  taken: Iterable<string> = [],
): string {
  const base =
    fileName
      .replace(/\.[^.]*$/, "")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .slice(0, MAX_MEDIA_NAME)
      .replace(/^-+|-+$/g, "") || kind;
  const used = new Set(taken);
  let name = base;
  for (let suffix = 2; used.has(name); suffix++) {
    name = `${base}-${suffix}`;
  }
  return name;
}

/** The part of an image to show; see `crop` on {@link ImageMeta}. */
export type ImageCrop = NonNullable<ImageMeta["crop"]>;

/** Four decimals: a crop edge to a ten-thousandth of the image, without float noise in the site. */
const roundFraction = (value: number) => Math.round(value * 10_000) / 10_000;

/**
 * The largest crop of an image with the aspect ratio `aspect` (width / height), centred on its
 * focal point as far as the image allows (G14: aspect presets). `undefined` when the image already
 * has that shape, so nothing needs cutting off.
 */
export function cropForAspect(
  image: Pick<ImageMeta, "width" | "height" | "focal">,
  aspect: number,
): ImageCrop | undefined {
  const imageAspect = image.width / image.height;
  if (Math.abs(aspect - imageAspect) < 0.005) {
    return undefined;
  }
  // A wider shape keeps the full width and cuts height; a narrower one keeps the full height.
  const width = roundFraction(aspect > imageAspect ? 1 : aspect / imageAspect);
  const height = roundFraction(aspect > imageAspect ? imageAspect / aspect : 1);
  const focal = image.focal ?? { x: 0.5, y: 0.5 };
  const start = (centre: number, size: number) =>
    roundFraction(Math.min(Math.max(centre - size / 2, 0), 1 - size));
  return { x: start(focal.x, width), y: start(focal.y, height), width, height };
}

/** Narrows a Media item to an image. */
export function isImageMeta(meta: MediaMeta): meta is ImageMeta {
  return meta.kind === "image";
}
