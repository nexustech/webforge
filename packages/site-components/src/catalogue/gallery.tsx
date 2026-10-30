import { t } from "@webforge/i18n";
import { defineComponent } from "../define.js";
import { contentWidthClass, defineSection } from "../frame.js";
import type { ComponentDef } from "../library.js";
import { Lightbox } from "../lightbox.js";
import { Picture } from "../picture.js";
import { SectionTitle } from "../typography.js";

const GALLERY_LAYOUTS = ["grid", "masonry", "featured"] as const;

/**
 * Each layout's classes for the element that holds the images (the slot's, see `SlotComponent`):
 * square crops in a grid; their own shapes in columns, which read down each column, so the tab
 * and reading order runs down too; or the first image large in a grid. Grid and the first image
 * large keep the order the images have.
 */
const IMAGES_CLASSES: Readonly<Record<(typeof GALLERY_LAYOUTS)[number], string>> = {
  grid: "grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 [&_img]:aspect-square [&_img]:h-full [&_img]:object-cover",
  masonry: "columns-2 gap-4 md:columns-3 [&>*]:mb-4 [&>*]:break-inside-avoid",
  featured:
    "grid grid-cols-2 gap-4 md:grid-cols-4 [&_img]:aspect-square [&_img]:h-full [&_img]:object-cover [&>*:first-child]:col-span-2 [&>*:first-child]:row-span-2",
};

/**
 * A gallery of images (2.7a, G10): a title and its images, in a grid of squares, in columns of
 * their own shapes, or with the first one large. Every image opens larger: `webforge.js`'s
 * "lightbox" behaviour shows it in the page, to go through with the buttons, the arrow keys or a
 * swipe; without JavaScript, its link opens its largest file.
 */
const gallery = defineSection({
  label: t("section.gallery"),
  name: "gallery",
  category: t("category.galleries"),
  variants: GALLERY_LAYOUTS.map((value) => ({ label: t(`field.galleryLayout.${value}`), value })),
  fields: {
    title: { kind: "text", label: t("field.title"), inline: true },
    images: { kind: "slot", label: t("field.images"), allow: ["GalleryImage"] },
  },
  defaults: { title: t("starter.galleryTitle"), contentWidth: "wide", images: [] },
  behaviours: ["lightbox"],
  frame: () => "bg-base-100",
  frameAttributes: () => ({ "data-wf-gallery": "" }),
  render: ({ values, slots }) => {
    const Images = slots.images;
    return (
      <>
        <div className={`mx-auto ${contentWidthClass(values.contentWidth)} space-y-8`}>
          <SectionTitle>{values.title}</SectionTitle>
          <Images className={IMAGES_CLASSES[values.variant]} />
        </div>
        <Lightbox />
      </>
    );
  },
});

/**
 * One image of a Gallery, with an optional caption. It links to the image's largest file, which
 * the export writes for the image's sources anyway: the lightbox opens it large, and without
 * JavaScript the browser shows the file. The link is named for what it opens: the image's alt
 * text, else its caption.
 */
const galleryImage = defineComponent({
  label: t("element.galleryImage"),
  place: "child",
  fields: {
    image: { kind: "media", label: t("field.image") },
    caption: { kind: "text", label: t("field.caption"), inline: true },
  },
  defaults: { caption: "" },
  render: ({ values, context }) => {
    const placed = values.image;
    const image = placed === undefined ? null : context.image(placed.mediaId);
    const alt = placed?.alt ?? image?.alt ?? "";
    // On the canvas an inline caption is the editor, not text: then the alt text or the fallback.
    const caption = typeof values.caption === "string" ? values.caption.trim() : "";
    const name = alt.trim() !== "" ? alt : caption !== "" ? caption : t("siteText.galleryImage");
    // Until an image is chosen: a space to see and select on the canvas, and nothing in the export.
    if (image === null && context.emptyImage === undefined) return null;
    return (
      <figure className="site-gallery-image space-y-2">
        {image === null ? (
          <div className="aspect-square w-full rounded-box bg-base-200" />
        ) : (
          <a
            href={image.src}
            className="block"
            aria-label={t("siteText.openLarger", { name })}
            data-wf-lightbox-item=""
          >
            <Picture
              image={image}
              alt={alt}
              sizes="(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw"
              className="w-full rounded-box"
            />
          </a>
        )}
        {/* Hidden when empty, without the gap under the image; on the canvas it holds its editor. */}
        <figcaption className="text-sm empty:hidden">{values.caption}</figcaption>
      </figure>
    );
  },
});

/** The Gallery and its images. */
export const galleryComponents: Readonly<Record<string, ComponentDef>> = {
  Gallery: gallery,
  GalleryImage: galleryImage,
};
