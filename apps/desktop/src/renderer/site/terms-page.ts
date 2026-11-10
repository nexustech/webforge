import { t } from "@webforge/i18n";
import type { NodeDoc, PageId, SiteDoc } from "@webforge/model";
import { businessOf, insertPolicyPage, openingSection, textSection } from "./policy-sections.js";

/** How to ask about the terms: by email, else by phone, from Site Settings, else on the site. */
function contactLine(site: SiteDoc): string {
  const { email, phone } = site.settings.contact;
  if (email !== undefined) return t("termsPage.contactEmail", { email });
  if (phone !== undefined) return t("termsPage.contactPhone", { phone });
  return t("termsPage.contactOther");
}

/**
 * The terms page's sections (#866, G20): who runs the site and where, using the site, prices and
 * bookings, links to other sites, changes to the terms, and how to ask. Written from `site`'s
 * Site Settings: its business name (or the site's name), postal address, and email or phone. It
 * opens with the page's main heading and the note to the owner that it's a start to check, not
 * legal advice ({@link openingSection}).
 */
export function termsPageContent(site: SiteDoc): NodeDoc[] {
  // An address typed over several lines reads as one in a sentence.
  const address = (site.settings.contact.address ?? "")
    .split(/\s*\n\s*/)
    .filter((line) => line.trim() !== "")
    .join(", ")
    .trim();
  return [
    openingSection("terms", t("termsPage.title")),
    textSection("terms-who", t("termsPage.whoTitle"), [
      t("termsPage.who", { business: businessOf(site) }),
      ...(address === "" ? [] : [t("termsPage.address", { address })]),
    ]),
    textSection("terms-use", t("termsPage.useTitle"), [t("termsPage.use"), t("termsPage.useCopy")]),
    textSection("terms-prices", t("termsPage.pricesTitle"), [t("termsPage.prices")]),
    textSection("terms-links", t("termsPage.linksTitle"), [t("termsPage.links")]),
    textSection("terms-changes", t("termsPage.changesTitle"), [t("termsPage.changes")]),
    textSection("terms-contact", t("termsPage.contactTitle"), [contactLine(site)]),
  ];
}

/**
 * Adds the terms page to `draft` (an undo step's) as page `id`: named *Terms*, its sections written
 * from the site as it is ({@link termsPageContent}).
 */
export function insertTermsPage(draft: SiteDoc, id: PageId): void {
  insertPolicyPage(draft, id, {
    title: t("termsPage.title"),
    description: t("termsPage.description"),
    content: termsPageContent(draft),
  });
}
