import type { SiteText } from "@webforge/i18n/site-text";
import { renderToStaticMarkup } from "react-dom/server";
import { LucideIcon } from "./icons.js";

/**
 * The back-to-top button (F-CM-9, 2.9b) the export adds to a page when Site Settings ask for it and
 * the page doesn't hide it: a link to the top (`#`) in the page's corner, named for screen readers. The
 * `back-to-top` behaviour shows it once the visitor has scrolled down; without it the link is
 * always there.
 *
 * In a `nav` of its own name, so it's in a landmark like the rest of the page (#1153): it comes
 * after the Footer, outside the page's others. The nav is what the behaviour shows and hides, so
 * no empty landmark is left while the link is hidden.
 */
function BackToTop({ siteText }: { readonly siteText: SiteText }) {
  const label = siteText("siteText.backToTop");
  return (
    <nav
      aria-label={label}
      // Not on paper: a printed page has nowhere to go back to.
      className="site-back-to-top fixed right-4 bottom-4 z-40 print:hidden"
      data-wf-back-to-top=""
    >
      <a
        // Always the page's top, even with a section anchored "top" (which "#top" would go to).
        // biome-ignore lint/a11y/useValidAnchor: an empty fragment is the page's top, which it links to.
        href="#"
        className="btn btn-circle btn-primary shadow-md"
        aria-label={label}
        title={label}
      >
        <LucideIcon name="arrow-up" className="size-5" />
      </a>
    </nav>
  );
}

/** {@link BackToTop} as the export writes it, in the site's language. */
export const backToTopHtml = (siteText: SiteText): string =>
  renderToStaticMarkup(<BackToTop siteText={siteText} />);
