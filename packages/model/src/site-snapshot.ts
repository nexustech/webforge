import { z } from "zod";
import {
  type LayoutDoc,
  layoutDocSchema,
  type PageDoc,
  pageDocSchema,
  type Theme,
  themeSchema,
} from "./documents.js";

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
  readonly path: string;
  /** Shown in the browser tab and in navigation. */
  readonly title: string;
  readonly description?: string | undefined;
  readonly doc: PageDoc;
};

/** An image (or other file) the site uses, stored once and referenced by `id`. */
export type MediaItem = {
  /** Stable id, e.g. the content hash of the original. Referenced from component props. */
  readonly id: string;
  /** Base name for exported files, e.g. `hero` → `assets/img/hero-640.webp`. */
  readonly name: string;
  readonly mimeType: "image/jpeg" | "image/png";
  /** The original file, never modified (X2). */
  readonly data: Uint8Array;
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
};

const sitePageSchema = z.object({
  path: pagePathSchema,
  title: z.string(),
  description: z.string().optional(),
  doc: pageDocSchema,
});

const mediaItemSchema = z.object({
  id: z.string().regex(/^[A-Za-z0-9_-]+$/),
  name: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  mimeType: z.enum(["image/jpeg", "image/png"]),
  data: z.instanceof(Uint8Array),
});

/**
 * Validates a {@link SiteSnapshot} arriving from outside (IPC, worker messages). Page paths must be
 * unique and one page must be the home page (`index`): both would otherwise break the export (X5).
 */
export const siteSnapshotSchema: z.ZodType<SiteSnapshot> = z
  .object({
    name: z.string().min(1),
    language: z.string().regex(/^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/),
    theme: themeSchema,
    layout: layoutDocSchema,
    pages: z.array(sitePageSchema).min(1),
    media: z.array(mediaItemSchema),
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
    const ids = site.media.map((item) => item.id);
    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({ code: "custom", message: "Duplicate media ids", path: ["media"] });
    }
  });
