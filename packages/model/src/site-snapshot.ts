import { z } from "zod";
import { type BindableSetting, bindableSettingSchema } from "./bindings.js";
import {
  type LayoutDoc,
  layoutDocSchema,
  type PageDoc,
  pageDocSchema,
  type Theme,
  themeSchema,
  withoutUnsafeKeys,
} from "./documents.js";
import { pageIdSchema } from "./ids.js";
import {
  cropSchema,
  FILE_MIME_TYPES,
  type FileMimeType,
  focalPointSchema,
  IMAGE_MIME_TYPES,
  type ImageCrop,
} from "./media.js";
import { type MenuDoc, menuDocSchema } from "./menu.js";
import {
  type FormService,
  formServiceSchema,
  languageTagSchema,
  type OpeningHours,
  openingHoursSchema,
  type SocialProfile,
  socialProfileSchema,
} from "./settings.js";

/**
 * A page's place in the exported site, without extension: `index`, `about`, `services/web-design`
 * (decision X1). Lowercase letters, digits and hyphens per segment; no reserved folder names.
 */
const pagePathSchema = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*$/)
  .refine((path) => path.split("/")[0] !== "assets", { message: "'assets' is reserved" });

/** One page of a {@link SiteSnapshot}. */
export type SitePage = {
  /** The page id (`PageId`); internal links point at it. */
  readonly id: string;
  readonly path: string;
  /** Shown in the browser tab, and in navigation unless `navLabel` is set. */
  readonly title: string;
  readonly navLabel?: string | undefined;
  readonly description?: string | undefined;
  /** Left out of the navigation, like the "Page not found" page. */
  readonly hideFromNavigation?: boolean | undefined;
  /** Rendered without the shared Header. */
  readonly hideHeader?: boolean | undefined;
  /** Rendered without the shared Footer. */
  readonly hideFooter?: boolean | undefined;
  /** Rendered without the site's back-to-top button (F-CM-9, 2.9). */
  readonly hideBackToTop?: boolean | undefined;
  /**
   * The Media image shown when the page is shared (`og:image`, 3.4): its own from Page Settings,
   * or the site's; none when neither is set.
   */
  readonly shareImage?: string | undefined;
  readonly doc: PageDoc;
};

/** An image (or other file) the site uses, stored once and referenced by `id`. */
export type MediaItem = {
  /** Stable id, e.g. the content hash of the original. Referenced from component props. */
  readonly id: string;
  /** Base name for exported files, e.g. `hero` → `assets/img/hero-640.webp`. */
  readonly name: string;
  readonly mimeType: (typeof IMAGE_MIME_TYPES)[number];
  /**
   * The original file, never modified (X2), or, instead, its SHA-256 `hash`: the build then reads
   * the bytes when it needs them (`PipelineResources.readMedia`), so a snapshot of a large site
   * doesn't carry every image (R15). One of the two is there.
   */
  readonly data?: Uint8Array | undefined;
  /** The SHA-256 of the original, by which the open site's file stores it. */
  readonly hash?: string | undefined;
  /** The image's own alt text from Media; a placement may override it (G15). */
  readonly alt?: string | undefined;
  /** The part kept in view where the image is cut to fit, as fractions of the original (G14). */
  readonly focal?: { readonly x: number; readonly y: number } | undefined;
  /** The part of the original the site shows, as fractions of it; the export cuts the rest. */
  readonly crop?: ImageCrop | undefined;
};

/**
 * A document in Media that a page links to (1.28, F-ED-24): the export copies it unchanged to
 * `files/<name>.<extension>`. Documents nothing links to aren't in the snapshot.
 */
export type DocumentItem = {
  readonly id: string;
  /** Base name of the exported file, e.g. `price-list` → `files/price-list.pdf`. */
  readonly name: string;
  readonly mimeType: FileMimeType;
  /** The original file, never modified, or its SHA-256 `hash` instead, as for a {@link MediaItem}. */
  readonly data?: Uint8Array | undefined;
  readonly hash?: string | undefined;
};

/**
 * An immutable copy of everything a build needs (export pipeline stage 1). Created by the app from
 * the open site and passed to the build worker.
 */
export type SiteSnapshot = {
  readonly name: string;
  /** `<html lang>`, e.g. `en` or `en-GB`. */
  readonly language: string;
  readonly theme: Theme;
  readonly layout: LayoutDoc;
  readonly pages: readonly SitePage[];
  readonly media: readonly MediaItem[];
  /** The documents pages link to (1.28); none when left out. */
  readonly documents?: readonly DocumentItem[] | undefined;
  /** The Site Settings values elements can be bound to (1.17); empty ones are left out. */
  readonly settings?: Readonly<Partial<Record<BindableSetting, string>>> | undefined;
  /** Site Settings' opening hours, which the Opening hours and contact section lists (2.8). */
  readonly openingHours?: readonly OpeningHours[] | undefined;
  /** Site Settings' social profiles, which the Social links element links to (2.9b). */
  readonly socialProfiles?: readonly SocialProfile[] | undefined;
  /** Where Site Settings send form submissions (F-CM-1), for the Contact form (2.8). */
  readonly formService?: FormService | undefined;
  /** Site Settings' back-to-top button (F-CM-9, 2.9), on pages that don't hide it. */
  readonly backToTop?: boolean | undefined;
  /**
   * The navigation menu (F-ED-17), which the Header renders. Without one, the navigation lists the
   * pages in order.
   */
  readonly menu?: MenuDoc | undefined;
  /** The Media image the favicon and app icons are made from (Site Settings, 3.4). */
  readonly icon?: string | undefined;
};

const sitePageSchema = z.object({
  id: pageIdSchema,
  path: pagePathSchema,
  title: z.string(),
  navLabel: z.string().optional(),
  description: z.string().optional(),
  hideFromNavigation: z.boolean().optional(),
  hideHeader: z.boolean().optional(),
  hideFooter: z.boolean().optional(),
  hideBackToTop: z.boolean().optional(),
  shareImage: z
    .string()
    .regex(/^[A-Za-z0-9_-]+$/)
    .optional(),
  doc: pageDocSchema,
});

/** A file's bytes, or the hash to read them by: one of the two (R15). */
const contentSchema = {
  data: z.instanceof(Uint8Array).optional(),
  hash: z
    .string()
    .regex(/^[0-9a-f]{64}$/)
    .optional(),
};
const hasContent = (item: { data?: Uint8Array | undefined; hash?: string | undefined }) =>
  item.data !== undefined || item.hash !== undefined;
const CONTENT_MISSING = { message: "Neither the file's bytes nor its hash" };

const mediaItemSchema = z
  .object({
    id: z.string().regex(/^[A-Za-z0-9_-]+$/),
    name: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    mimeType: z.enum(IMAGE_MIME_TYPES),
    ...contentSchema,
    alt: z.string().optional(),
    focal: focalPointSchema.optional(),
    crop: cropSchema.optional(),
  })
  .refine(hasContent, CONTENT_MISSING);

const documentItemSchema = z
  .object({
    id: z.string().regex(/^[A-Za-z0-9_-]+$/),
    name: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    mimeType: z.enum(FILE_MIME_TYPES),
    ...contentSchema,
  })
  .refine(hasContent, CONTENT_MISSING);

/**
 * Validates a {@link SiteSnapshot} arriving from outside (IPC, worker messages). Page paths must be
 * unique and one page must be the home page (`index`): both would otherwise break the export (X5).
 */
export const siteSnapshotSchema: z.ZodType<SiteSnapshot> = withoutUnsafeKeys(
  z
    .object({
      name: z.string().min(1),
      language: languageTagSchema,
      theme: themeSchema,
      layout: layoutDocSchema,
      pages: z.array(sitePageSchema).min(1),
      media: z.array(mediaItemSchema),
      documents: z.array(documentItemSchema).optional(),
      settings: z.partialRecord(bindableSettingSchema, z.string()).optional(),
      openingHours: z.array(openingHoursSchema).optional(),
      socialProfiles: z.array(socialProfileSchema).optional(),
      formService: formServiceSchema.optional(),
      backToTop: z.boolean().optional(),
      menu: menuDocSchema.optional(),
      icon: z
        .string()
        .regex(/^[A-Za-z0-9_-]+$/)
        .optional(),
    })
    .superRefine((site, ctx) => {
      const paths = site.pages.map((page) => page.path);
      if (!paths.includes("index")) {
        ctx.addIssue({ code: "custom", message: "The site has no home page", path: ["pages"] });
      }
      const duplicates = paths.filter((path, index) => paths.indexOf(path) !== index);
      if (duplicates.length > 0) {
        ctx.addIssue({
          code: "custom",
          message: `Duplicate page paths: ${[...new Set(duplicates)].join(", ")}`,
          path: ["pages"],
        });
      }
      const pageIds = site.pages.map((page) => page.id);
      if (new Set(pageIds).size !== pageIds.length) {
        ctx.addIssue({ code: "custom", message: "Duplicate page ids", path: ["pages"] });
      }
      const ids = site.media.map((item) => item.id);
      if (new Set(ids).size !== ids.length) {
        ctx.addIssue({ code: "custom", message: "Duplicate media ids", path: ["media"] });
      }
      // Exported image files are named after the media name (assets/img/<name>-640.webp).
      const names = site.media.map((item) => item.name);
      if (new Set(names).size !== names.length) {
        ctx.addIssue({ code: "custom", message: "Duplicate media names", path: ["media"] });
      }
      // Exported documents are named after theirs too (files/<name>.<extension>).
      const documents = site.documents ?? [];
      const documentIds = documents.map((item) => item.id);
      const documentNames = documents.map((item) => item.name);
      if (
        new Set(documentIds).size !== documentIds.length ||
        new Set(documentNames).size !== documentNames.length
      ) {
        ctx.addIssue({ code: "custom", message: "Duplicate documents", path: ["documents"] });
      }
    }),
);
