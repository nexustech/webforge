import {
  fileTransferSignInSchema,
  fileTransferTrustSchema,
  IMAGE_MIME_TYPES,
  publishDestinationSchema,
  SECRET_MAX,
  siteDocSchema,
  siteSnapshotSchema,
  themeSchema,
} from "@webforge/model";
import { catalogueFontSchema } from "@webforge/themes";
import { z } from "zod";
import { exportWarningSchema, MAX_REPORTED_WARNINGS } from "./ipc/site.js";

/**
 * The downloaded families a site's theme uses (2.2), as the main process keeps them: its heading
 * and body fonts at most. The worker knows the catalogue's itself.
 */
const downloadedFamiliesSchema = z.array(catalogueFontSchema).max(2);

/**
 * What the main process asks the export worker to do. The snapshot names its images and
 * documents by hash: the worker asks for each one's bytes as the build reaches it (`read-blob`,
 * worker-channel-protocol.ts), so neither process holds them all (R15).
 */
const exportJobSchema = z.strictObject({
  type: z.literal("export"),
  snapshot: siteSnapshotSchema,
  /** Absolute path of the folder or ZIP file to write; chosen by the user in a native dialog. */
  destination: z.string().min(1),
  format: z.enum(["folder", "zip"]),
  /** *Minify output* and *Include developer files* (3.3). */
  output: z.strictObject({ minify: z.boolean(), developerFiles: z.boolean() }),
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

/**
 * Builds the open site for the preview server (3.2), in memory: the snapshot, fonts and families
 * as an export's, and nothing written anywhere. The preview worker keeps the files of its last
 * build, to answer with only those that changed.
 */
const previewJobSchema = exportJobSchema
  .omit({ type: true, destination: true, format: true, output: true })
  .extend({ type: z.literal("preview") });

/** Builds the open site for the preview server. */
export type PreviewJob = z.infer<typeof previewJobSchema>;

/** A SHA-256, as hex: of a piece of code, or of a stored file. */
const sha256Schema = z.string().regex(/^[0-9a-f]{64}$/);

/**
 * Publishes a site to a destination (4.5, ADR 0018 §1): the site main read from the file and
 * gated, the destination with the sign-in main read from the keychain for this job only, and what
 * this computer trusts about it. The worker makes the snapshot (§3), builds it and uploads it; it
 * holds the sign-in for the job and never logs it, nor puts it in an outcome.
 */
const publishJobSchema = z.strictObject({
  type: z.literal("publish"),
  site: siteDocSchema,
  destination: publishDestinationSchema,
  signIn: z.union([
    fileTransferSignInSchema,
    z.strictObject({ token: z.string().min(1).max(SECRET_MAX) }),
  ]),
  trust: fileTransferTrustSchema,
  /** The site and destination the remote manifest records (A8), and leave to replace another. */
  target: z.strictObject({
    site: z.strictObject({
      projectId: z.string().min(1).max(200),
      destinationId: z.string().min(1).max(200),
    }),
    replaceOtherSite: z.boolean().optional(),
  }),
  /**
   * The SHA-256 of each piece of the site's code its owner trusts on this computer (#649): the
   * rest is built blank, as an export leaves it.
   */
  trustedCode: z.array(sha256Schema).max(10_000),
  fonts: exportJobSchema.shape.fonts,
  families: downloadedFamiliesSchema,
});

/** Publishes a site to a destination. */
export type PublishJob = z.infer<typeof publishJobSchema>;

/** Compiles the site CSS for the canvas; a long-lived worker answers many of these (1.12). */
const compileCssJobSchema = z.strictObject({
  type: z.literal("compile-css"),
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
  theme: themeSchema,
  classes: z.array(classNameSchema).max(MAX_CLASS_CSS),
});

/** The CSS each class produces. */
export type ClassCssJob = z.infer<typeof classCssJobSchema>;

/** An image's size in Media, before any crop. */
const imageSizeSchema = z.strictObject({ width: z.int().positive(), height: z.int().positive() });

/**
 * What Advanced mode's CSS tab asks for (3.14): one item of a page as the export writes it. The
 * canvas styles worker answers it with the pipeline's own rendering. The snapshot has no image
 * sizes, so they come with it, by Media id: no image is read.
 */
export const itemHtmlRequestSchema = z.strictObject({
  snapshot: siteSnapshotSchema,
  sizes: z.record(z.string().min(1).max(64), imageSizeSchema),
  pageId: z.string().min(1).max(64),
  nodeId: z.string().min(1).max(200),
});

/** An item of a page to write as the export would. */
export type ItemHtmlRequest = z.infer<typeof itemHtmlRequestSchema>;

const itemHtmlJobSchema = itemHtmlRequestSchema.extend({ type: z.literal("item-html") });

/** An item of a page to write as the export would, in the canvas styles worker. */
export type ItemHtmlJob = z.infer<typeof itemHtmlJobSchema>;

/** Bytes of any buffer kind (a Node `Buffer` too), which `z.instanceof` would narrow. */
export const bytesSchema = z.custom<Uint8Array>((value) => value instanceof Uint8Array);

/** Makes the editor's preview of a Media image (1.16); a long-lived worker answers many. */
const thumbnailJobSchema = z.strictObject({
  type: z.literal("thumbnail"),
  mimeType: z.enum(IMAGE_MIME_TYPES),
  /** The original's bytes. */
  data: bytesSchema,
});

/** Makes the editor's preview of a Media image. */
export type ThumbnailJob = z.infer<typeof thumbnailJobSchema>;

/** Any job the worker accepts. */
export const workerJobSchema = z.discriminatedUnion("type", [
  exportJobSchema,
  previewJobSchema,
  publishJobSchema,
  compileCssJobSchema,
  classCatalogueJobSchema,
  classCssJobSchema,
  itemHtmlJobSchema,
  thumbnailJobSchema,
]);

/** Any job the worker accepts. */
export type WorkerJob = z.infer<typeof workerJobSchema>;

/** The worker's answer to a {@link ThumbnailJob}: a WebP, or a failure without details. */
export const thumbnailOutcomeSchema = z.discriminatedUnion("type", [
  z.strictObject({
    type: z.literal("thumbnail"),
    data: bytesSchema,
  }),
  z.strictObject({ type: z.literal("thumbnail-failed") }),
]);

/** The worker's answer to a {@link ThumbnailJob}. */
export type ThumbnailOutcome = z.infer<typeof thumbnailOutcomeSchema>;

/** The worker's answer to a {@link CompileCssJob}. */
const compileCssOutcomeSchema = z.discriminatedUnion("type", [
  z.strictObject({
    type: z.literal("css"),
    css: z.string(),
    bodyClass: z.string(),
  }),
  z.strictObject({ type: z.literal("css-failed") }),
]);

/** The worker's answer to a {@link CompileCssJob}. */
export type CompileCssOutcome = z.infer<typeof compileCssOutcomeSchema>;

/** The worker's answer to a {@link ClassCatalogueJob} or a {@link ClassCssJob}. */
const classesOutcomeSchema = z.discriminatedUnion("type", [
  z.strictObject({
    type: z.literal("class-catalogue"),
    classes: z.array(classNameSchema).max(100_000),
    variants: z.array(classNameSchema).max(1_000),
  }),
  z.strictObject({
    type: z.literal("class-css"),
    css: z.array(z.string().max(100_000).nullable()).max(MAX_CLASS_CSS),
  }),
  z.strictObject({ type: z.literal("classes-failed") }),
]);

/** The worker's answer to a {@link ClassCatalogueJob} or a {@link ClassCssJob}. */
export type ClassesOutcome = z.infer<typeof classesOutcomeSchema>;

/** An item's HTML as the export writes it (3.14), or a failure: always without details. */
const itemHtmlOutcomeSchema = z.discriminatedUnion("type", [
  z.strictObject({
    type: z.literal("item-html"),
    /** `""` for a hidden item; `null` when the page or the item isn't there. */
    html: z.string().max(1_000_000).nullable(),
  }),
  z.strictObject({ type: z.literal("item-html-failed") }),
]);

/** The worker's answer to an {@link ItemHtmlJob}. */
export type ItemHtmlOutcome = z.infer<typeof itemHtmlOutcomeSchema>;

/**
 * Everything the canvas styles worker answers: CSS for the canvas, the class catalogue, and an
 * item's HTML for the CSS tab.
 */
export const canvasStylesOutcomeSchema = z.union([
  compileCssOutcomeSchema,
  classesOutcomeSchema,
  itemHtmlOutcomeSchema,
]);

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
    /** For the export report: never logged, as they name the site's pages. */
    warnings: z.array(exportWarningSchema).max(MAX_REPORTED_WARNINGS),
    warningCount: z.int().nonnegative(),
    durationMs: z.number().nonnegative(),
  }),
  /** Cancelled: nothing was changed on disk (R15). */
  z.strictObject({ type: z.literal("cancelled") }),
  z.strictObject({
    type: z.literal("failed"),
    code: z.enum([
      "folder-not-empty",
      "write-failed",
      "build-failed",
      "reserved-name",
      "too-large",
      "unreadable-image",
    ]),
    /** A machine-readable detail such as a BuildError code; safe to log. */
    detail: z.string(),
    /** The title of the page to fix, for `reserved-name`: shown to the person, never logged. */
    page: z.string().max(500).optional(),
    /** The id of the Media image to replace, for `unreadable-image` (S12). */
    image: z.string().max(500).optional(),
  }),
]);

/** What the export worker reports back. */
export type ExportOutcome = z.infer<typeof exportOutcomeSchema>;

/**
 * Why a publish failed (4.5): the publisher's codes (`PublishErrorCode` of `@webforge/publish`),
 * or the build's, as an export's.
 */
export const PUBLISH_FAILURES = [
  "unauthorized",
  "not-found",
  "rate-limited",
  "rejected",
  "network",
  "untrusted-host",
  "no-encryption",
  "bad-key",
  "other-site",
  "failed",
  "build-failed",
  "reserved-name",
  "unreadable-image",
] as const;

/**
 * What a publish job reports back (ADR 0018 §1): what went up and the live site's check, with the
 * publisher's version of it (Netlify's deploy id), for main to record; cancelled, the previous site
 * left as it was; or why it failed, by its code only (standards §4).
 */
export const publishOutcomeSchema = z.discriminatedUnion("type", [
  z.strictObject({
    type: z.literal("published"),
    /** The address the live site was checked at: none for a destination without one. */
    url: z.string().max(2048),
    uploaded: z.int().nonnegative(),
    unchanged: z.int().nonnegative(),
    removed: z.int().nonnegative(),
    version: z.string().min(1).max(200).optional(),
    check: z.enum(["live", "different", "unreachable", "unchecked"]),
    durationMs: z.number().nonnegative(),
  }),
  z.strictObject({ type: z.literal("cancelled") }),
  z.strictObject({
    type: z.literal("failed"),
    code: z.enum(PUBLISH_FAILURES),
    /** A machine-readable detail such as a BuildError code; safe to log. */
    detail: z.string().max(200),
    /** The title of the page to fix, for `reserved-name`: shown to the person, never logged. */
    page: z.string().max(500).optional(),
    /** The id of the Media image to replace, for `unreadable-image` (S12). */
    image: z.string().max(500).optional(),
  }),
]);

/** What a publish job reports back. */
export type PublishOutcome = z.infer<typeof publishOutcomeSchema>;

/** A built file's path, as the build names them: `about.html`, `assets/css/site.css`. */
const builtPathSchema = z
  .string()
  .min(1)
  .max(1024)
  .regex(/^(?!\/)(?!.*(?:^|\/)\.\.?(?:\/|$))[^\\\0]+$/);

/** At most this many files in one preview: well above any site Webforge makes. */
const MAX_PREVIEW_FILES = 50_000;

/**
 * The preview worker's answer to a {@link PreviewJob} (3.2): the files that changed since its last
 * build and those gone, or every file (`full`) when it has none from before. A failure carries only
 * a code, as an export's does.
 */
export const previewOutcomeSchema = z.discriminatedUnion("type", [
  z.strictObject({
    type: z.literal("previewed"),
    full: z.boolean(),
    changed: z
      .array(z.strictObject({ path: builtPathSchema, data: bytesSchema }))
      .max(MAX_PREVIEW_FILES),
    removed: z.array(builtPathSchema).max(MAX_PREVIEW_FILES),
  }),
  z.strictObject({ type: z.literal("preview-failed"), detail: z.string().max(200) }),
]);

/** The preview worker's answer to a {@link PreviewJob}. */
export type PreviewOutcome = z.infer<typeof previewOutcomeSchema>;
