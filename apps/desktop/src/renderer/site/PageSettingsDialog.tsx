import { FormDialog, type FormField, type FormSpec } from "@webforge/editor-ui";
import { t } from "@webforge/i18n";
import {
  type CollectionField,
  collectionOf,
  type ImageMeta,
  ITEM_VALUE_MAX,
  isImageMeta,
  type MediaId,
  mediaItem,
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
import { HelpButton } from "../help/index.js";
import { fileNameFor, type PageSettingsChange } from "./page-actions.js";
import { pagePreview, thumbnailUrl } from "./page-preview.js";
import { SearchResultCard } from "./SearchResultCard.js";
import { ShareCard } from "./ShareCard.js";

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

/**
 * A post's field as the dialog names its value (6.10a): `item.date`, beside the page's own
 * values, so its fields are one form.
 */
const itemKey = (field: string) => `item.${field}` as const;

/** What the dialog edits: each value as typed; a post's fields under {@link itemKey}. */
type PageValues = Readonly<Record<`item.${string}`, string | undefined>> & {
  readonly title: string;
  readonly slug: string;
  readonly description: string;
  readonly shareImage: MediaId | undefined;
  readonly hideHeader: boolean;
  readonly hideFooter: boolean;
  readonly hideFromNavigation: boolean;
  readonly hideBackToTop: boolean;
  readonly hideFromSearch: boolean;
  readonly privacy: boolean;
  readonly draft: boolean;
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
  privacy: z.boolean(),
  draft: z.boolean(),
  // A post's fields (6.10a): read for their kind by the model, so any text up to the limit.
  entry: z.record(z.string(), z.string().max(ITEM_VALUE_MAX)).optional(),
});

/**
 * A post's field in Page Settings (6.10a): a date picker, a few lines of text, or a picture from
 * Media, labelled as its Blog names it.
 */
function postField(
  field: CollectionField,
  images: readonly ImageMeta[],
  imageUrl: (image: ImageMeta) => string,
): FormField {
  const name = itemKey(field.name);
  switch (field.kind) {
    case "date":
      return {
        kind: "text",
        name,
        label: field.label,
        inputType: "date",
        help: t("blog.settings.dateHint"),
        width: "md",
      };
    case "text":
      return {
        kind: "text",
        name,
        label: field.label,
        multiline: true,
        maxLength: ITEM_VALUE_MAX,
        help: t("blog.settings.summaryHint"),
      };
    case "tags":
      return {
        kind: "text",
        name,
        label: field.label,
        maxLength: ITEM_VALUE_MAX,
        help: t("blog.settings.tagsHint"),
      };
    case "image":
      return {
        kind: "imageChoice",
        name,
        label: field.label,
        noneLabel: t("blog.settings.noPicture"),
        options: images.map((image) => ({
          value: image.id,
          label: image.name,
          thumbnail: imageUrl(image),
        })),
        ...(images.length === 0 ? { help: t("pageSettings.noImages") } : {}),
      };
  }
}

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
  // A post's fields come straight after its title, where they're easy to find (6.10a, M2-1).
  const postFields = collectionOf(site, page)?.fields ?? [];
  const isPost = page.collection !== undefined;
  return {
    fields: ({ slug }): readonly FormField[] => [
      {
        kind: "text",
        name: "title",
        label: t("pageSettings.pageTitle"),
        maxLength: PAGE_TITLE_MAX,
      },
      ...postFields.map((field) => postField(field, images, imageUrl)),
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
      // A draft (G37, #864): any page but the Home page and "Page not found", first among what
      // the page leaves out, as it leaves out the whole page.
      ...(page.kind === "page" && page.id !== site.homePageId
        ? [
            {
              kind: "toggle" as const,
              name: "draft",
              label: t("pageSettings.draft"),
              help: t("pageSettings.draftHint"),
            },
          ]
        : []),
      { kind: "toggle", name: "hideHeader", label: t("pageSettings.hideHeader") },
      { kind: "toggle", name: "hideFooter", label: t("pageSettings.hideFooter") },
      // "Page not found" is never in navigation, nor shown by search engines. A post is never in
      // navigation by itself: its Blog lists it.
      ...(page.kind === "page" && !isPost
        ? [
            {
              kind: "toggle" as const,
              name: "hideFromNavigation",
              label: t("pageSettings.hideFromNavigation"),
            },
          ]
        : []),
      ...(page.kind === "page"
        ? [
            // One is the menu, the other is search (3.15, SEO-2).
            {
              kind: "toggle" as const,
              name: "hideFromSearch",
              label: t("pageSettings.hideFromSearch"),
              help: t("pageSettings.hideFromSearchHint"),
            },
            // What Site Check looks for when the site collects visitors' details (#855).
            {
              kind: "toggle" as const,
              name: "privacy",
              label: t("pageSettings.privacy"),
              help: t("pageSettings.privacyHint"),
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
      // A post is shared with its picture unless it chooses a share image (6.10a).
      const picture = postFields.find((field) => field.kind === "image");
      const preview = pagePreview(
        site,
        page,
        picture === undefined ? values : { ...values, picture: values[itemKey(picture.name)] },
        imageUrl,
      );
      return {
        description: <SearchResultCard preview={preview} />,
        shareImage: <ShareCard preview={preview} />,
      };
    },
    schema: pageSettingsFormSchema,
    toModel: (values) => {
      // The page's own values, without its post's fields, which go together as its entry.
      const own = Object.fromEntries(
        Object.entries(values).filter(([key]) => !key.startsWith("item.")),
      );
      return {
        ...own,
        // An emptied file name keeps the page's own; a fixed one isn't the dialog's to change.
        slug:
          fixedFile !== undefined || values.slug.trim() === "" ? page.slug : slugify(values.slug),
        description: values.description.trim(),
        ...(isPost
          ? {
              entry: Object.fromEntries(
                postFields.map((field) => [field.name, (values[itemKey(field.name)] ?? "").trim()]),
              ),
            }
          : {}),
      };
    },
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
      help={<HelpButton topic="pageSettings" />}
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
        privacy: page.settings.privacy === true,
        draft: page.settings.draft === true,
        // A post's fields as stored; a picture that isn't one shows as none (6.10a).
        ...Object.fromEntries(
          (collectionOf(site, page)?.fields ?? []).map((field) => {
            const stored =
              page.entry !== undefined && Object.hasOwn(page.entry, field.name)
                ? page.entry[field.name]
                : undefined;
            const value =
              field.kind === "image"
                ? stored !== undefined && mediaItem(site.media, stored)?.kind === "image"
                  ? stored
                  : undefined
                : (stored ?? "");
            return [itemKey(field.name), value];
          }),
        ),
      }}
      onSave={(change) => onSave({ ...change, shareImage: change.shareImage })}
      onCancel={onCancel}
    />
  );
}
