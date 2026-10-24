import { IMAGE_MIME_TYPES, siteSnapshotSchema, themeSchema } from "@webforge/model";
import { catalogueFontSchema } from "@webforge/themes";
import { z } from "zod";

/**
 * The downloaded families a site's theme uses (2.2), as the main process keeps them: its heading
 * and body fonts at most. The worker knows the catalogue's itself.
 */
const downloadedFamiliesSchema = z.array(catalogueFontSchema).max(2);

/** What the main process asks the export worker to do. */
const exportJobSchema = z.strictObject({
  type: z.literal("export"),
  snapshot: siteSnapshotSchema,
  /** Absolute path of the folder to write; chosen by the user in a native dialog. */
  destination: z.string().min(1),
  /** The site's font files (2.2), read and checked by the main process: the worker reads none. */
  fonts: z
    .array(
      z.strictObject({
        file: z.string().regex(/^[a-z0-9-]+\.woff2$/),
        data: z.instanceof(Uint8Array),
      }),
    )
    .max(64),
  families: downloadedFamiliesSchema,
});

/** What the main process asks the export worker to do. */
export type ExportJob = z.infer<typeof exportJobSchema>;

/** Compiles the site CSS for the canvas; a long-lived worker answers many of these (1.12). */
const compileCssJobSchema = z.strictObject({
  type: z.literal("compile-css"),
  /** Matches the answer to the request. */
  id: z.int().nonnegative(),
  theme: themeSchema,
  candidates: z.array(z.string()),
  families: downloadedFamiliesSchema,
});

/** Compiles the site CSS for the canvas. */
export type CompileCssJob = z.infer<typeof compileCssJobSchema>;

/**
 * Lists every class the site's styles support, for the Edit panel's CSS classes field (#276). The
 * canvas styles worker answers it, from the same Tailwind setup as the site's CSS.
 */
const classCatalogueJobSchema = z.strictObject({
  type: z.literal("class-catalogue"),
  id: z.int().nonnegative(),
  theme: themeSchema,
});

/** Lists every class the site's styles support. */
export type ClassCatalogueJob = z.infer<typeof classCatalogueJobSchema>;

/** At most this many classes in one {@link ClassCssJob}: what one view of the list shows. */
export const MAX_CLASS_CSS = 200;

/** A class name as the CSS classes field holds one: no spaces, nothing longer than this. */
export const classNameSchema = z.string().min(1).max(128).regex(/^\S+$/);

/** The CSS each class produces, for the class browser's previews and the unknown-class warning. */
const classCssJobSchema = z.strictObject({
  type: z.literal("class-css"),
  id: z.int().nonnegative(),
  theme: themeSchema,
  classes: z.array(classNameSchema).max(MAX_CLASS_CSS),
});

/** The CSS each class produces. */
export type ClassCssJob = z.infer<typeof classCssJobSchema>;

/** Bytes of any buffer kind (a Node `Buffer` too), which `z.instanceof` would narrow. */
const bytesSchema = z.custom<Uint8Array>((value) => value instanceof Uint8Array);

/** Makes the editor's preview of a Media image (1.16); a long-lived worker answers many. */
const thumbnailJobSchema = z.strictObject({
  type: z.literal("thumbnail"),
  id: z.int().nonnegative(),
  mimeType: z.enum(IMAGE_MIME_TYPES),
  /** The original's bytes. */
  data: bytesSchema,
});

/** Makes the editor's preview of a Media image. */
export type ThumbnailJob = z.infer<typeof thumbnailJobSchema>;

/** Any job the worker accepts. */
export const workerJobSchema = z.discriminatedUnion("type", [
  exportJobSchema,
  compileCssJobSchema,
  classCatalogueJobSchema,
  classCssJobSchema,
  thumbnailJobSchema,
]);

/** The worker's answer to a {@link ThumbnailJob}: a WebP, or a failure without details. */
export const thumbnailOutcomeSchema = z.discriminatedUnion("type", [
  z.strictObject({
    type: z.literal("thumbnail"),
    id: z.int().nonnegative(),
    data: bytesSchema,
  }),
  z.strictObject({ type: z.literal("thumbnail-failed"), id: z.int().nonnegative() }),
]);

/** The worker's answer to a {@link ThumbnailJob}. */
export type ThumbnailOutcome = z.infer<typeof thumbnailOutcomeSchema>;

/** The worker's answer to a {@link CompileCssJob}. */
const compileCssOutcomeSchema = z.discriminatedUnion("type", [
  z.strictObject({
    type: z.literal("css"),
    id: z.int().nonnegative(),
    css: z.string(),
    bodyClass: z.string(),
  }),
  z.strictObject({ type: z.literal("css-failed"), id: z.int().nonnegative() }),
]);

/** The worker's answer to a {@link CompileCssJob}. */
export type CompileCssOutcome = z.infer<typeof compileCssOutcomeSchema>;

/** The worker's answer to a {@link ClassCatalogueJob} or a {@link ClassCssJob}. */
const classesOutcomeSchema = z.discriminatedUnion("type", [
  z.strictObject({
    type: z.literal("class-catalogue"),
    id: z.int().nonnegative(),
    classes: z.array(classNameSchema).max(100_000),
    variants: z.array(classNameSchema).max(1_000),
  }),
  z.strictObject({
    type: z.literal("class-css"),
    id: z.int().nonnegative(),
    css: z.array(z.string().max(100_000).nullable()).max(MAX_CLASS_CSS),
  }),
  z.strictObject({ type: z.literal("classes-failed"), id: z.int().nonnegative() }),
]);

/** The worker's answer to a {@link ClassCatalogueJob} or a {@link ClassCssJob}. */
export type ClassesOutcome = z.infer<typeof classesOutcomeSchema>;

/** Everything the canvas styles worker answers: CSS for the canvas, and the class catalogue. */
export const canvasStylesOutcomeSchema = z.union([compileCssOutcomeSchema, classesOutcomeSchema]);

/**
 * What the export worker reports back. Failures carry only a code: no paths, no site content
 * (standards §4, logging).
 */
export const exportOutcomeSchema = z.discriminatedUnion("type", [
  z.strictObject({
    type: z.literal("exported"),
    pages: z.int().nonnegative(),
    files: z.int().nonnegative(),
    bytes: z.int().nonnegative(),
    warnings: z.int().nonnegative(),
    durationMs: z.number().nonnegative(),
  }),
  z.strictObject({
    type: z.literal("failed"),
    code: z.enum(["folder-not-empty", "write-failed", "build-failed"]),
    /** A machine-readable detail such as a BuildError code; safe to log. */
    detail: z.string(),
  }),
]);

/** What the export worker reports back. */
export type ExportOutcome = z.infer<typeof exportOutcomeSchema>;
