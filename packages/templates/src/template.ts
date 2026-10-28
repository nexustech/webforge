import {
  copyTheme,
  IMAGE_MIME_TYPES,
  type ImageMeta,
  type MediaId,
  mediaIdSchema,
  mediaNameSchema,
  migrateSite,
  type SiteDoc,
  SiteFormatError,
  type ThemeTokens,
} from "@webforge/model";
import { z } from "zod";
import { type BusinessDetails, withBusiness } from "./business.js";
import { TEMPLATE_CATEGORIES } from "./categories.js";
import { choosePages, type PageChoices } from "./page-choices.js";

/**
 * The templates Webforge ships (2.14a, F-SITE-1, S2), by id: each a folder of this package's
 * `templates/` with its `template.json` and `images.json`. Their names and descriptions are
 * `t("template.<id>.name")` and `t("template.<id>.description")`; 2.15 adds its eight here, and
 * {@link BLANK_TEMPLATE_ID}.
 */
export const TEMPLATE_IDS = [
  "cafe",
  "salon",
  "trades",
  "consultant",
  "photographer",
  "shop",
  "personal",
  "blank",
] as const;

/** One of {@link TEMPLATE_IDS}. */
export type TemplateId = (typeof TEMPLATE_IDS)[number];

/**
 * The Blank site (2.15c, product owner 26 Oct 2026): what New Site makes when no template is
 * chosen. Home, About and Contact as short skeletons, no photos, in the theme New Site chose. It has
 * no business type, so New Site shows it as its own choice, not among the templates.
 */
export const BLANK_TEMPLATE_ID = "blank" satisfies TemplateId;

/**
 * The licences a template's image may have (Q6): free to copy into every site made from it and
 * into its export, with no credit owed.
 */
export const TEMPLATE_IMAGE_LICENCES = ["CC0-1.0", "public-domain"] as const;

/**
 * One image of a template and where it came from (the image-licence manifest, S5): its file, the
 * Media item it becomes in a site made from the template, and its source, author and licence.
 */
export const templateImageSchema = z.strictObject({
  /** The file in the template's `images/` folder. */
  file: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*\.(?:jpg|png)$/),
  /** The Media item's id, which the template's pages place the image by. */
  mediaId: mediaIdSchema,
  name: mediaNameSchema,
  mimeType: z.enum(IMAGE_MIME_TYPES),
  /** SHA-256 of the file: a test checks it, so the manifest always describes the file. */
  hash: z.string().regex(/^[0-9a-f]{64}$/),
  width: z.int().positive(),
  height: z.int().positive(),
  alt: z.string(),
  /** Where the image came from: its page on the web, or how it was made. */
  source: z.string().min(1).max(500),
  author: z.string().min(1).max(200),
  licence: z.enum(TEMPLATE_IMAGE_LICENCES),
});

/** See {@link templateImageSchema}. */
export type TemplateImage = z.infer<typeof templateImageSchema>;

/** A template's images (`images.json`): each file and each Media id once. */
export const imageManifestSchema = z
  .array(templateImageSchema)
  .refine((images) => new Set(images.map((image) => image.file)).size === images.length, {
    message: "An image file is listed twice",
  })
  .refine((images) => new Set(images.map((image) => image.mediaId)).size === images.length, {
    message: "A Media id is listed twice",
  });

/**
 * A template's site, in whatever format it was written in: migrated to the current one, as a
 * site file is, so a template keeps working when the format moves on (`migrateSite`), then
 * validated. A site this build can't read, or one that fails validation, is refused.
 */
const templateSiteSchema = z.unknown().transform((raw, context): SiteDoc => {
  try {
    return migrateSite(raw);
  } catch (error) {
    context.addIssue({
      code: "custom",
      message: error instanceof SiteFormatError ? error.message : "The site could not be read",
    });
    return z.NEVER;
  }
});

/**
 * A template (`template.json`): its business type, whether *Try an example* offers it (PG-3), and
 * the site a new site starts as ({@link templateSiteSchema}). Its Media is empty: the images come
 * from the manifest, with the hash of their bytes, as the site file stores them.
 */
export const templateSchema = z
  .strictObject({
    id: z.enum(TEMPLATE_IDS),
    /** Its business type; `null` for {@link BLANK_TEMPLATE_ID} only. */
    category: z.enum(TEMPLATE_CATEGORIES).nullable(),
    /** Offered by *Try an example*: complete sample content to edit (PG-3). */
    example: z.boolean(),
    site: templateSiteSchema,
  })
  .refine((template) => Object.keys(template.site.media).length === 0, {
    message: "A template's images belong in its images.json, not in its site's Media",
  })
  .refine((template) => (template.category === null) === (template.id === BLANK_TEMPLATE_ID), {
    message: "Every template but Blank has a business type",
  });

/** See {@link templateSchema}. */
export type Template = z.infer<typeof templateSchema>;

/**
 * The site a new site starts as when made from `template` (2.14a): the template's pages, layout,
 * menu and settings, named `name` and in `theme`, with Media for every image in `images`. The
 * images' bytes go into the site file as their Media items say (the main process stores them).
 */
export function siteFromTemplate(
  template: Template,
  images: readonly TemplateImage[],
  options: {
    readonly name: string;
    readonly theme: ThemeTokens;
    /**
     * The person's business (QS-2), from the quick start or New Site: it replaces the template's
     * sample business in Site Settings and the copy. Without it, as *Try an example* makes a site,
     * the sample business stays: an example is someone else's finished site.
     */
    readonly business?: BusinessDetails;
    /** The quick start's Pages step (QS-3): template pages left out, recipe pages added. */
    readonly pages?: PageChoices;
  },
): SiteDoc {
  const site = structuredClone(template.site);
  if (options.business !== undefined) withBusiness(site, options.name, options.business);
  if (options.pages !== undefined) choosePages(site, options.pages);
  site.settings.general.name = options.name;
  site.theme = copyTheme(options.theme);
  for (const image of images) {
    const meta: ImageMeta = {
      id: image.mediaId as MediaId,
      hash: image.hash,
      name: image.name,
      fileName: image.file,
      kind: "image",
      mimeType: image.mimeType,
      width: image.width,
      height: image.height,
      alt: image.alt,
    };
    site.media[meta.id] = meta;
  }
  return site;
}
