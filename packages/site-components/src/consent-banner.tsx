import { t } from "@webforge/i18n";
import type { SiteAnalytics } from "@webforge/model";
import { renderToStaticMarkup } from "react-dom/server";

/**
 * Google Analytics' consent banner (3.8, B4, B7), which the export adds after every page's Footer
 * when Site Settings have a Measurement ID. It carries the ID for the `consent` behaviour, which
 * loads Google's script only once the visitor accepts (or at once, without cookies, when the person
 * turned the banner off), and never from disk. Hidden until the behaviour knows the visitor hasn't
 * chosen yet, so without JavaScript nothing shows and nothing is counted. In the theme's page
 * colours.
 */
function ConsentBanner({ analytics }: { readonly analytics: SiteAnalytics }) {
  return (
    <section
      data-wf-consent=""
      data-measurement-id={analytics.measurementId}
      {...(analytics.consentBanner ? { "data-ask": "" } : {})}
      aria-label={t("siteText.consent.label")}
      className="site-consent fixed inset-x-4 bottom-4 z-50 mx-auto max-w-xl rounded-box border border-base-300 bg-base-100 p-4 text-base-content shadow-xl print:hidden"
      hidden
    >
      {analytics.consentBanner ? (
        <>
          <p className="text-sm">
            {analytics.consentMessage?.trim() || t("siteText.consent.message")}
          </p>
          <div className="mt-3 flex flex-wrap justify-end gap-2">
            <button type="button" className="btn btn-sm btn-ghost" data-wf-consent-decline="">
              {t("siteText.consent.decline")}
            </button>
            <button type="button" className="btn btn-sm btn-primary" data-wf-consent-accept="">
              {t("siteText.consent.accept")}
            </button>
          </div>
        </>
      ) : null}
    </section>
  );
}

/** {@link ConsentBanner} as the export writes it. */
export const consentBannerHtml = (analytics: SiteAnalytics): string =>
  renderToStaticMarkup(<ConsentBanner analytics={analytics} />);
