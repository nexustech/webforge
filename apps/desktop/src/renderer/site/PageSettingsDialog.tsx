import { FormDialog, type FormField, type FormSpec } from "@webforge/editor-ui";
import { t } from "@webforge/i18n";
import {
  type ImageMeta,
  isImageMeta,
  type MediaId,
  PAGE_DESCRIPTION_MAX,
  PAGE_SLUG_MAX,
  PAGE_TITLE_MAX,
  type PageEntry,
  pageEntrySchema,
  type SiteDoc,
  slugify,
  slugSchema,
} from "@webforge/model";
import { z } from "zod";
import "../shell/form-messages.js";
import { fileNameFor, type PageSettingsChange } from "./page-actions.js";
import { pagePreview, SearchResultCard, ShareCard, thumbnailUrl } from "./page-preview.js";

/** Props of {@link PageSettingsDialog}. */
export type PageSettingsDialogProps = {
  readonly open: boolean;
  readonly site: SiteDoc;
  /** The page whose settings are shown; the dialog keeps the last one while it fades out. */
  readonly page: PageEntry | undefined;
  readonly onSave: (change: PageSettingsChange) => void;
  readonly onCancel: () => void;
  /** A Media image's thumbnail; the app's, unless a story draws its own. */
  readonly imageUrl?: (image: ImageMeta) => string;
};

/** What the dialog edits: each value as typed. */
type PageValues = {
  readonly title: string;
  readonly slug: string;
  readonly description: string;
  readonly shareImage: MediaId | undefined;
  readonly hideHeader: boolean;
  readonly hideFooter: boolean;
  readonly hideFromNavigation: boolean;
  readonly hideBackToTop: boolean;
  readonly hideFromSearch: boolean;
};

const settings = pageEntrySchema.shape.settings.shape;

/**
 * Page Settings checked by the model's own schema (2.21, decision 5): the page entry's title and
 * settings, and a file name made file-friendly first, so a name that saved before still does.
 */
const pageSettingsFormSchema = z.object({
  title: pageEntrySchema.shape.title.trim().min(1),
  slug: slugSchema,
  description: settings.description.unwrap(),
  shareImage: settings.shareImage,
  hideHeader: settings.hideHeader,
  hideFooter: settings.hideFooter,
  hideFromNavigation: settings.hideFromNavigation,
  hideBackToTop: z.boolean(),
  hideFromSearch: z.boolean(),
});

/**
 * Page Settings as a form (F-SET-2, 2.21): the title and description, the file name (fixed for
 * the Home page and "Page not found"), the share image, and what the page leaves out; with the page
 * as a search result and as a shared link (3.16).
 */
export function pageSettingsSpec(
  site: SiteDoc,
  page: PageEntry,
  imageUrl: (image: ImageMeta) => string = thumbnailUrl,
): FormSpec<PageValues, z.infer<typeof pageSettingsFormSchema>> {
  const fixedFile =
    page.id === site.homePageId
      ? t("pageSettings.homeFile")
      : page.kind === "not-found"
        ? t("pageSettings.notFoundFile")
        : undefined;
  const images = Object.values(site.media).filter(isImageMeta);
  const siteDescription = site.settings.general.description;
  return {
    fields: ({ slug }): readonly FormField[] => [
      {
        kind: "text",
        name: "title",
        label: t("pageSettings.pageTitle"),
        maxLength: PAGE_TITLE_MAX,
      },
      {
        kind: "text",
        name: "slug",
        label: t("pageSettings.fileName"),
        help:
          fixedFile ??
          t("pages.fileName", {
            path: fileNameFor(site, slug.trim() === "" ? page.slug : slug, page.folder, page.id),
          }),
        maxLength: PAGE_SLUG_MAX,
        ...(fixedFile === undefined ? {} : { disabled: true }),
      },
      {
        kind: "text",
        name: "description",
        label: t("pageSettings.metaDescription"),
        help: t("pageSettings.metaDescriptionHint"),
        multiline: true,
        maxLength: PAGE_DESCRIPTION_MAX,
        ...(siteDescription === undefined ? {} : { placeholder: siteDescription }),
      },
      {
        kind: "imageChoice",
        name: "shareImage",
        label: t("pageSettings.shareImage"),
        noneLabel: t("pageSettings.siteShareImage"),
        options: images.map((image) => ({
          value: image.id,
          label: image.name,
          thumbnail: imageUrl(image),
        })),
        ...(images.length === 0 ? { help: t("pageSettings.noImages") } : {}),
      },
      { kind: "toggle", name: "hideHeader", label: t("pageSettings.hideHeader") },
      { kind: "toggle", name: "hideFooter", label: t("pageSettings.hideFooter") },
      // "Page not found" is never in navigation, nor shown by search engines.
      ...(page.kind === "page"
        ? [
            {
              kind: "toggle" as const,
              name: "hideFromNavigation",
              label: t("pageSettings.hideFromNavigation"),
            },
            // One is the menu, the other is search (3.15, SEO-2).
            {
              kind: "toggle" as const,
              name: "hideFromSearch",
              label: t("pageSettings.hideFromSearch"),
              help: t("pageSettings.hideFromSearchHint"),
            },
          ]
        : []),
      // Only while the site shows one (Site Settings → General).
      ...(site.settings.general.backToTop === true
        ? [
            {
              kind: "toggle" as const,
              name: "hideBackToTop",
              label: t("pageSettings.hideBackToTop"),
            },
          ]
        : []),
    ],
    // The page as a search result under its description, and as a shared link under its share
    // image, as the export will write them, updating as the person types (3.16).
    after: (values) => {
      const preview = pagePreview(site, page, values, imageUrl);
      return {
        description: <SearchResultCard preview={preview} />,
        shareImage: <ShareCard preview={preview} />,
      };
    },
    schema: pageSettingsFormSchema,
    toModel: (values) => ({
      ...values,
      // An emptied file name keeps the page's own; a fixed one isn't the dialog's to change.
      slug: fixedFile !== undefined || values.slug.trim() === "" ? page.slug : slugify(values.slug),
      description: values.description.trim(),
    }),
  };
}

/**
 * Page Settings (F-SET-2): the title and description search engines and browser tabs show, the
 * file name, the image shown when the page is shared, and whether the page shows the Header and
 * Footer and is in navigation. Saved as one undo step. The Home page is always `index.html` and
 * "Page not found" always `404.html`, so their file names can't be changed here.
 */
export function PageSettingsDialog({
  open,
  site,
  page,
  onSave,
  onCancel,
  imageUrl = thumbnailUrl,
}: PageSettingsDialogProps) {
  if (page === undefined) return null;
  const fixed = page.id === site.homePageId || page.kind === "not-found";
  return (
    <FormDialog
      open={open}
      title={t("pageSettings.title", { name: page.title })}
      description={t("pageSettings.description")}
      confirm={t("pageSettings.save")}
      spec={pageSettingsSpec(site, page, imageUrl)}
      initial={{
        title: page.title,
        // A fixed file name shows as it is ("index.html").
        slug: fixed ? fileNameFor(site, page.slug, undefined, page.id) : page.slug,
        description: page.settings.description ?? "",
        shareImage: page.settings.shareImage,
        hideHeader: page.settings.hideHeader,
        hideFooter: page.settings.hideFooter,
        hideFromNavigation: page.settings.hideFromNavigation,
        hideBackToTop: page.settings.hideBackToTop === true,
        hideFromSearch: page.settings.hideFromSearch === true,
      }}
      onSave={(change) => onSave({ ...change, shareImage: change.shareImage })}
      onCancel={onCancel}
    />
  );
}
