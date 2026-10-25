import { t } from "@webforge/i18n";
import { renderToStaticMarkup } from "react-dom/server";
import { LucideIcon } from "./icons.js";

/**
 * The back-to-top button (F-CM-9, 2.9b) the export adds to a page when Site Settings ask for it and
 * the page doesn't hide it: a link to the top in the page's corner, named for screen readers. The
 * `back-to-top` behaviour shows it once the visitor has scrolled down; without it the link is
 * always there.
 */
function BackToTop() {
  return (
    <a
      href="#top"
      // Not on paper: a printed page has nowhere to go back to.
      className="site-back-to-top btn btn-circle btn-primary fixed right-4 bottom-4 z-40 shadow-md print:hidden"
      aria-label={t("siteText.backToTop")}
      title={t("siteText.backToTop")}
      data-wf-back-to-top=""
    >
      <LucideIcon name="arrow-up" className="size-5" />
    </a>
  );
}

/** {@link BackToTop} as the export writes it. */
export const backToTopHtml = (): string => renderToStaticMarkup(<BackToTop />);
