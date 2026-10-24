import { t } from "@webforge/i18n";
import { defineComponent } from "../define.js";
import { boxClasses, type ComponentDef } from "../library.js";
import { Picture } from "../picture.js";
import { MARGIN_FIELD, marginClasses, PADDING_FIELD, SECTION_PADDING } from "./basic.js";

const GALLERY_LAYOUTS = ["grid", "masonry", "featured"] as const;

/**
 * Each layout's classes for the element that holds the images (the slot's, see `SlotComponent`):
 * square crops in a grid; their own shapes in columns; or the first image large in a grid.
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
 * behind it out of reach; Esc closes it, as does its button or a click beside it.
 */
function Lightbox() {
  const button = "btn btn-circle btn-ghost";
  return (
    <dialog
      className="modal"
      aria-label={t("siteText.lightbox")}
      data-wf-lightbox=""
      data-image-of={t("siteText.imageOf")}
    >
      <div className="modal-box flex max-w-5xl flex-col items-center gap-3 p-4">
        <form method="dialog" className="self-end">
          <button type="submit" className={button} aria-label={t("siteText.close")}>
            <Icon path="M18 6 6 18M6 6l12 12" />
          </button>
        </form>
        <figure className="flex w-full flex-col items-center gap-2">
          <img
            className="max-h-[70vh] w-auto max-w-full rounded-box object-contain"
            alt=""
            data-wf-lightbox-image=""
          />
          <figcaption className="text-center" data-wf-lightbox-caption="" />
        </figure>
        <div className="flex items-center gap-3">
          <button
            type="button"
            className={button}
            aria-label={t("siteText.previousImage")}
            data-wf-lightbox-previous=""
          >
            <Icon path="m15 18-6-6 6-6" />
          </button>
          <p className="text-sm" aria-live="polite" data-wf-lightbox-status="" />
          <button
            type="button"
            className={button}
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
 * their own shapes, or with the first one large. Each image links to its full-size file, which a
 * click opens without JavaScript too; with `webforge.js`'s "lightbox" behaviour it opens large in
 * the page instead, to go through with the buttons, the arrow keys or a swipe.
 */
const gallery = defineComponent({
  label: t("section.gallery"),
  place: "section",
  category: t("category.galleries"),
  variants: GALLERY_LAYOUTS.map((value) => ({ label: t(`field.galleryLayout.${value}`), value })),
  fields: {
    title: { kind: "text", label: t("field.title"), inline: true },
    images: { kind: "slot", label: t("field.images"), allow: ["GalleryImage"] },
    lightbox: { kind: "toggle", label: t("field.lightbox") },
    padding: PADDING_FIELD,
    margin: MARGIN_FIELD,
  },
  defaults: { title: t("starter.galleryTitle"), images: [], lightbox: true },
  behaviours: (values) => (values.lightbox ? ["lightbox"] : []),
  render: ({ values, slots }) => {
    const Images = slots.images;
    return (
      <section
        className={`site-gallery bg-base-100 ${boxClasses(values.padding, "padding", SECTION_PADDING)}${marginClasses(values.margin)}`}
        {...(values.lightbox ? { "data-wf-gallery": "" } : {})}
      >
        <div className="mx-auto max-w-6xl space-y-8">
          <h2 className="text-3xl font-bold">{values.title}</h2>
          <Images className={IMAGES_CLASSES[values.variant]} />
        </div>
        {values.lightbox ? <Lightbox /> : null}
      </section>
    );
  },
});

/**
 * One image of a Gallery, with an optional caption. It links to the image's full-size file: the
 * lightbox opens it large, and without JavaScript the browser shows the file.
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
    return (
      <figure className="site-gallery-image space-y-2">
        {image === null ? (
          <div className="aspect-square w-full rounded-box bg-base-200" />
        ) : (
          <a href={image.src} className="block" data-wf-lightbox-item="">
            <Picture
              image={image}
              alt={placed?.alt ?? image.alt}
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
