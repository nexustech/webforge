import { z } from "zod";
import { mediaIdSchema } from "./ids.js";

/** Image types Media accepts; the export makes WebP plus a fallback in the original type (X2). */
export const IMAGE_MIME_TYPES = ["image/jpeg", "image/png"] as const;
/** Other files a link can point at (F-ED-18 "File"). */
export const FILE_MIME_TYPES = ["application/pdf"] as const;

const fraction = z.number().min(0).max(1);

/** A point on an image as fractions of its width and height; `{x: 0.5, y: 0.5}` is the centre. */
const focalPointSchema = z.strictObject({ x: fraction, y: fraction });

/** The part of an image to show, as fractions of the original's width and height. */
const cropSchema = z
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

/** Narrows a Media item to an image. */
export function isImageMeta(meta: MediaMeta): meta is ImageMeta {
  return meta.kind === "image";
}
