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
import { cropSchema, focalPointSchema, IMAGE_MIME_TYPES, type ImageCrop } from "./media.js";
import { type MenuDoc, menuDocSchema } from "./menu.js";
import { languageTagSchema } from "./settings.js";

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
  readonly doc: PageDoc;
};

/** An image (or other file) the site uses, stored once and referenced by `id`. */
export type MediaItem = {
  /** Stable id, e.g. the content hash of the original. Referenced from component props. */
  readonly id: string;
  /** Base name for exported files, e.g. `hero` → `assets/img/hero-640.webp`. */
  readonly name: string;
  readonly mimeType: (typeof IMAGE_MIME_TYPES)[number];
  /** The original file, never modified (X2). */
  readonly data: Uint8Array;
  /** The image's own alt text from Media; a placement may override it (G15). */
  readonly alt?: string | undefined;
  /** The part kept in view where the image is cut to fit, as fractions of the original (G14). */
  readonly focal?: { readonly x: number; readonly y: number } | undefined;
  /** The part of the original the site shows, as fractions of it; the export cuts the rest. */
  readonly crop?: ImageCrop | undefined;
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
  /** The Site Settings values elements can be bound to (1.17); empty ones are left out. */
  readonly settings?: Readonly<Partial<Record<BindableSetting, string>>> | undefined;
  /**
   * The navigation menu (F-ED-17), which the Header renders. Without one, the navigation lists the
   * pages in order.
   */
  readonly menu?: MenuDoc | undefined;
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
  doc: pageDocSchema,
});

const mediaItemSchema = z.object({
  id: z.string().regex(/^[A-Za-z0-9_-]+$/),
  name: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  mimeType: z.enum(IMAGE_MIME_TYPES),
  data: z.instanceof(Uint8Array),
  alt: z.string().optional(),
  focal: focalPointSchema.optional(),
  crop: cropSchema.optional(),
});

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
      settings: z.partialRecord(bindableSettingSchema, z.string()).optional(),
      menu: menuDocSchema.optional(),
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
    }),
);
