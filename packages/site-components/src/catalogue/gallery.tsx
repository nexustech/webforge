import { t } from "@webforge/i18n";
import { defineComponent } from "../define.js";
import { defineSection } from "../frame.js";
import type { ComponentDef } from "../library.js";
import { Picture } from "../picture.js";
import { BUTTON_CLASSES, SectionTitle } from "../typography.js";

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

/** A small icon for the lightbox's buttons, drawn inline so the site needs no icon font (C8). */
function Icon({ path }: { readonly path: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={path} />
    </svg>
  );
}

/**
 * The lightbox: a native `<dialog>`, which `webforge.js`'s "lightbox" behaviour opens with the
 * image clicked, large, with its caption. Opened as a modal, it keeps the focus in it and the page
 * behind it out of reach and still; Esc, its button or a click beside it closes it. The image is a
 * `<picture>` the script gives the image's own sources, as wide as the screen (`sizes="100vw"`), so
 * a phone doesn't load the largest file. A swipe moves through the images, while scrolling up and
 * down and zooming with two fingers stay the browser's (`touch-pan-y`).
 */
function Lightbox() {
  return (
    <dialog
      className="modal"
      aria-label={t("siteText.lightbox")}
      data-wf-lightbox=""
      data-image-of={t("siteText.imageOf")}
    >
      <div className="modal-box flex max-w-5xl flex-col items-center gap-3 p-4">
        <form method="dialog" className="self-end">
          <button type="submit" className={BUTTON_CLASSES.icon} aria-label={t("siteText.close")}>
            <Icon path="M18 6 6 18M6 6l12 12" />
          </button>
        </form>
        <figure className="flex w-full flex-col items-center gap-2">
          <picture data-wf-lightbox-picture="">
            <img
              className="max-h-[70vh] w-auto max-w-full touch-pan-y rounded-box object-contain"
              alt=""
              data-wf-lightbox-image=""
            />
          </picture>
          <figcaption className="text-center" data-wf-lightbox-caption="" />
        </figure>
        <div className="flex items-center gap-3">
          <button
            type="button"
            className={BUTTON_CLASSES.icon}
            aria-label={t("siteText.previousImage")}
            data-wf-lightbox-previous=""
          >
            <Icon path="m15 18-6-6 6-6" />
          </button>
          <p className="text-sm" aria-live="polite" data-wf-lightbox-status="" />
          <button
            type="button"
            className={BUTTON_CLASSES.icon}
            aria-label={t("siteText.nextImage")}
            data-wf-lightbox-next=""
          >
            <Icon path="m9 18 6-6-6-6" />
          </button>
        </div>
      </div>
      {/* A click beside the image closes it, as daisyUI's modals do; not a tab stop of its own. */}
      <form method="dialog" className="modal-backdrop">
        <button type="submit" tabIndex={-1}>
          {t("siteText.close")}
        </button>
      </form>
    </dialog>
  );
}

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
  defaults: { title: t("starter.galleryTitle"), images: [] },
  behaviours: ["lightbox"],
  frame: () => "bg-base-100",
  frameAttributes: () => ({ "data-wf-gallery": "" }),
  render: ({ values, slots }) => {
    const Images = slots.images;
    return (
      <>
        <div className="mx-auto max-w-6xl space-y-8">
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
        <figcaption className="text-sm">{values.caption}</figcaption>
      </figure>
    );
  },
});

/** The Gallery and its images. */
export const galleryComponents: Readonly<Record<string, ComponentDef>> = {
  Gallery: gallery,
  GalleryImage: galleryImage,
};
