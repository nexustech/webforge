import { t } from "@webforge/i18n";
import { insertPage, type NodeDoc, type PageId, type SiteDoc } from "@webforge/model";
import { siteCollects } from "@webforge/site-check";

const HTML_ESCAPES: Readonly<Record<string, string>> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
};

/** `text` as rich text's paragraph: a business name or an email address can hold `&` or `<`. */
const paragraph = (text: string) =>
  `<p>${text.replace(/[&<>"]/g, (character) => HTML_ESCAPES[character] ?? character)}</p>`;

/** A Text section titled `title` with `paragraphs`, in the page's colours. */
const textSection = (id: string, title: string, paragraphs: readonly string[]): NodeDoc => ({
  type: "TextSection",
  props: { id, colors: "page", title, text: paragraphs.map(paragraph).join("") },
});

/**
 * The privacy page's sections (#855, PH5-1): who runs the site, what it collects and why, how long
 * it's kept, the visitor's rights and how to ask. Written from `site`: its business name (or the
 * site's name) and email from Site Settings, and only what it collects: messages from a form,
 * newsletter sign-ups, and visits Google Analytics counts, with or without the consent banner
 * asking first. It opens with the page's main heading and a note to the owner that it's a start to
 * check, not legal advice, which Site Check finds while it's left in.
 */
export function privacyPageContent(site: SiteDoc): NodeDoc[] {
  const { contact, analytics, general } = site.settings;
  const business = (contact.businessName ?? "").trim() || general.name;
  const { messages, signups, visits } = siteCollects(site);
  const details = messages || signups;
  const visitText = analytics.consentBanner
    ? t("privacyPage.collectsVisitsConsent")
    : t("privacyPage.collectsVisitsCookieless");
  const collected = [
    ...(messages ? [t("privacyPage.collectsMessages")] : []),
    ...(signups ? [t("privacyPage.collectsSignups")] : []),
    ...(visits ? [visitText] : []),
  ];
  const sections: NodeDoc[] = [
    // The page's main heading: a text-only Hero, without a button, holding the note to the owner.
    {
      type: "Hero",
      props: {
        id: "privacy",
        variant: "minimal",
        colors: "page",
        title: t("privacyPage.title"),
        text: t("privacyPage.note"),
        buttonLabel: "",
      },
    },
    textSection("privacy-who", t("privacyPage.whoTitle"), [t("privacyPage.who", { business })]),
    textSection(
      "privacy-collects",
      t("privacyPage.collectsTitle"),
      collected.length === 0 ? [t("privacyPage.collectsNothing")] : collected,
    ),
  ];
  if (collected.length > 0) {
    sections.push(
      textSection("privacy-why", t("privacyPage.whyTitle"), [
        ...(details ? [t("privacyPage.whyDetails")] : []),
        ...(visits ? [t("privacyPage.whyVisits")] : []),
        t("privacyPage.whyNotSold"),
      ]),
      textSection("privacy-keep", t("privacyPage.keepTitle"), [
        ...(messages ? [t("privacyPage.keepMessages")] : []),
        ...(signups ? [t("privacyPage.keepSignups")] : []),
        ...(visits ? [t("privacyPage.keepVisits")] : []),
      ]),
    );
  }
  sections.push(
    textSection("privacy-rights", t("privacyPage.rightsTitle"), [t("privacyPage.rights")]),
    textSection("privacy-contact", t("privacyPage.contactTitle"), [
      contact.email === undefined
        ? t("privacyPage.contactNoEmail")
        : t("privacyPage.contactEmail", { email: contact.email }),
    ]),
  );
  return sections;
}

/**
 * Adds the privacy page to `draft` (an undo step's) as page `id`: named *Privacy*, marked as the
 * site's privacy page, its sections written from the site as it is ({@link privacyPageContent}),
 * before a "Page not found" page that is last and in the menu if the menu follows the pages.
 */
export function insertPrivacyPage(draft: SiteDoc, id: PageId): void {
  const content = privacyPageContent(draft);
  insertPage(draft, id, t("privacyPage.title"));
  const page = draft.pages[id];
  if (page === undefined) return;
  page.settings.description = t("privacyPage.description");
  page.settings.privacy = true;
  page.doc.content = content;
}
