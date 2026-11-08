import { t, template } from "@webforge/i18n";
import { renderToStaticMarkup } from "react-dom/server";
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
 * `single`, the one a page shares for its Images that open larger (3.20, #646): one picture,
 * without the previous and next buttons or the count. A Gallery has a lightbox of its own.
 */
export function Lightbox({ single = false }: { readonly single?: boolean }) {
  return (
    <dialog
      className="modal"
      aria-label={t("siteText.lightbox")}
      data-wf-lightbox=""
      {...(single
        ? { "data-wf-lightbox-single": "" }
        : { "data-image-of": template("siteText.imageOf") })}
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

/**
 * The attribute an Image that opens larger has on its figure (3.20): a page with one gets the
 * {@link singleLightboxHtml} its Images share.
 */
export const ENLARGE_ATTRIBUTE = "data-wf-enlarge";

/**
 * The single-picture lightbox the export adds once to a page whose Images open larger (#646),
 * rather than one in each Image: the `lightbox` behaviour shows each Image's picture in it.
 */
export const singleLightboxHtml = (): string => renderToStaticMarkup(<Lightbox single />);
