import { t, template } from "@webforge/i18n";
import { BUTTON_CLASSES } from "./typography.js";

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
 * The lightbox (2.7a, G10): a native `<dialog>`, which `webforge.js`'s "lightbox" behaviour opens
 * with the image clicked, large, with its caption. Opened as a modal, it keeps the focus in it and the page
 * behind it out of reach and still; Esc, its button or a click beside it closes it. The image is a
 * `<picture>` the script gives the image's own sources, as wide as the screen (`sizes="100vw"`), so
 * a phone doesn't load the largest file. A swipe moves through the images, while scrolling up and
 * down and zooming with two fingers stay the browser's (`touch-pan-y`).
 *
 * `single`, for an Image that opens larger (3.20): one picture, without the previous and next
 * buttons or the count.
 */
export function Lightbox({ single = false }: { readonly single?: boolean }) {
  return (
    <dialog
      className="modal"
      aria-label={t("siteText.lightbox")}
      data-wf-lightbox=""
      data-image-of={template("siteText.imageOf")}
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
          <figcaption className="text-center empty:hidden" data-wf-lightbox-caption="" />
        </figure>
        {single ? null : (
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
        )}
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
