import { t } from "@webforge/i18n";
import type { NodeDoc, PageId, SiteDoc } from "@webforge/model";
import { siteEmbeds } from "@webforge/site-check";
import { insertPolicyPage, openingSection, textSection } from "./policy-sections.js";

/**
 * Whether *Add Page* offers the cookie policy for `site` (#866): while Google Analytics has a
 * Measurement ID, the only thing the export loads that can set cookies before a visitor asks.
 */
export const offersCookiePolicy = (site: SiteDoc): boolean =>
  site.settings.analytics.measurementId !== undefined;

/**
 * The cookie policy's sections (#866, G20): what cookies are, the ones the site uses, videos and
 * maps from other sites, how to change the choice, and how to ask. Written from `site` as the
 * export draws it:
 * - with the consent banner, Google Analytics sets its cookies (`_ga`, `_ga_<id>`) only once the
 *   visitor agrees, the choice is kept in their browser, and *Cookie settings* in the Footer
 *   changes it (3.8, B7, #539);
 * - without it, visits are counted without cookies (B4, amended 30 Oct 2026);
 * - videos and maps (YouTube, Vimeo, a map's site) load when the visitor clicks them, or accepts
 *   all in the banner, and may set their own cookies.
 * It opens with the page's main heading and the note to the owner ({@link openingSection}).
 */
export function cookiePageContent(site: SiteDoc): NodeDoc[] {
  const { analytics, contact } = site.settings;
  const counted = analytics.measurementId !== undefined;
  // The banner shows only while Google Analytics counts visits.
  const asks = counted && analytics.consentBanner;
  const ours = asks
    ? [t("cookiePage.analyticsConsent"), t("cookiePage.choiceKept")]
    : [counted ? t("cookiePage.analyticsCookieless") : t("cookiePage.none")];
  const sections: NodeDoc[] = [
    openingSection("cookies", t("cookiePage.title")),
    textSection("cookies-what", t("cookiePage.whatTitle"), [t("cookiePage.what")]),
    textSection("cookies-ours", t("cookiePage.oursTitle"), ours),
  ];
  if (siteEmbeds(site)) {
    sections.push(
      textSection("cookies-embeds", t("cookiePage.embedsTitle"), [
        asks
          ? t("cookiePage.embedsConsent", { acceptAll: t("siteText.consent.accept") })
          : t("cookiePage.embedsClick"),
      ]),
    );
  }
  sections.push(
    textSection("cookies-change", t("cookiePage.changeTitle"), [
      ...(asks
        ? [t("cookiePage.changeSettings", { settings: t("siteText.consent.settings") })]
        : []),
      t("cookiePage.changeBrowser"),
    ]),
    textSection("cookies-contact", t("cookiePage.contactTitle"), [
      contact.email === undefined
        ? t("cookiePage.contactOther")
        : t("cookiePage.contactEmail", { email: contact.email }),
    ]),
  );
  return sections;
}

/**
 * Adds the cookie policy to `draft` (an undo step's) as page `id`: named *Cookies*, its sections
 * written from the site as it is ({@link cookiePageContent}).
 */
export function insertCookiePage(draft: SiteDoc, id: PageId): void {
  insertPolicyPage(draft, id, {
    title: t("cookiePage.title"),
    description: t("cookiePage.description"),
    content: cookiePageContent(draft),
  });
}
