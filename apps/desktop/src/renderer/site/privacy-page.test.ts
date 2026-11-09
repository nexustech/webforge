import { t } from "@webforge/i18n";
import { type NodeDoc, type PageId, type SiteDoc, siteDocSchema } from "@webforge/model";
import { checkSite } from "@webforge/site-check";
import { CATALOGUE } from "@webforge/site-components/catalogue-data";
import { describe, expect, it } from "vitest";
import { starterSite } from "../../shared/starter-site.js";
import { sessionWith } from "../testing/fixtures.js";
import { addPrivacyPage, changePageSettings } from "./page-actions.js";
import { privacyPageContent } from "./privacy-page.js";

/** The starter site with `content` on its home page, and Site Settings' `settings` changes. */
function siteWith(
  content: NodeDoc[],
  settings: {
    readonly businessName?: string;
    readonly email?: string;
    readonly measurementId?: string;
    readonly consentBanner?: boolean;
  } = {},
): SiteDoc {
  const site = starterSite();
  site.pages[site.homePageId]?.doc.content.push(...content);
  if (settings.businessName !== undefined)
    site.settings.contact.businessName = settings.businessName;
  if (settings.email !== undefined) site.settings.contact.email = settings.email;
  if (settings.measurementId !== undefined) {
    site.settings.analytics.measurementId = settings.measurementId;
  }
  if (settings.consentBanner !== undefined) {
    site.settings.analytics.consentBanner = settings.consentBanner;
  }
  return site;
}

const contactForm: NodeDoc = { type: "ContactForm", props: { id: "write" } };
const newsletter: NodeDoc = { type: "Newsletter", props: { id: "news" } };

/** Each section's title and its paragraphs' text, as the page shows them: a Hero's text is plain. */
const sectionsOf = (content: readonly NodeDoc[]) =>
  content.map((node) => ({
    title: node.props.title,
    text: String(node.props.text)
      .split("</p>")
      .filter((part) => part !== "")
      .map((part) => part.replace(/^<p>/, "")),
  }));

/** The page's opening section: its main heading, and the note to the owner. */
const opening = {
  type: "Hero",
  props: {
    id: "privacy",
    variant: "minimal",
    colors: "page",
    title: t("privacyPage.title"),
    text: t("privacyPage.note"),
    buttonLabel: "",
  },
};

/** The rules with a finding in `site`'s check for publishing. */
const failing = (site: SiteDoc) =>
  checkSite({ site, catalogue: CATALOGUE }, "publish")
    .results.filter((result) => result.findings.length > 0)
    .map((result) => result.rule);

describe("the privacy page (#855, PH5-1)", () => {
  it("says what a site with a contact form collects, from its business name and email", () => {
    const site = siteWith([contactForm], {
      businessName: "Rosa's Bakery",
      email: "hello@rosas.example",
    });

    const content = privacyPageContent(site);
    expect(content[0]).toEqual(opening);
    expect(sectionsOf(content)).toEqual([
      { title: t("privacyPage.title"), text: [t("privacyPage.note")] },
      {
        title: t("privacyPage.whoTitle"),
        text: [t("privacyPage.who", { business: "Rosa's Bakery" })],
      },
      { title: t("privacyPage.collectsTitle"), text: [t("privacyPage.collectsMessages")] },
      {
        title: t("privacyPage.whyTitle"),
        text: [t("privacyPage.whyDetails"), t("privacyPage.whyNotSold")],
      },
      { title: t("privacyPage.keepTitle"), text: [t("privacyPage.keepMessages")] },
      { title: t("privacyPage.rightsTitle"), text: [t("privacyPage.rights")] },
      {
        title: t("privacyPage.contactTitle"),
        text: [t("privacyPage.contactEmail", { email: "hello@rosas.example" })],
      },
    ]);
  });

  it("says how Google Analytics counts visits, with the banner asking first or without cookies", () => {
    const asked = sectionsOf(
      privacyPageContent(siteWith([newsletter], { measurementId: "G-ABC123DEF4" })),
    );
    expect(asked[2]?.text).toEqual([
      t("privacyPage.collectsSignups"),
      t("privacyPage.collectsVisitsConsent"),
    ]);
    expect(asked[3]?.text).toEqual([
      t("privacyPage.whyDetails"),
      t("privacyPage.whyVisits"),
      t("privacyPage.whyNotSold"),
    ]);
    expect(asked[4]?.text).toEqual([t("privacyPage.keepSignups"), t("privacyPage.keepVisits")]);

    const cookieless = privacyPageContent(
      siteWith([], { measurementId: "G-ABC123DEF4", consentBanner: false }),
    );
    expect(sectionsOf(cookieless)[2]?.text).toEqual([t("privacyPage.collectsVisitsCookieless")]);
  });

  it("falls back to the site's name, says nothing is collected, and asks to be contacted on the site", () => {
    const site = siteWith([]);
    const sections = sectionsOf(privacyPageContent(site));

    expect(sections.map((section) => section.title)).toEqual([
      t("privacyPage.title"),
      t("privacyPage.whoTitle"),
      t("privacyPage.collectsTitle"),
      t("privacyPage.rightsTitle"),
      t("privacyPage.contactTitle"),
    ]);
    expect(sections[1]?.text).toEqual([
      t("privacyPage.who", { business: site.settings.general.name }),
    ]);
    expect(sections[2]?.text).toEqual([t("privacyPage.collectsNothing")]);
    expect(sections[4]?.text).toEqual([t("privacyPage.contactNoEmail")]);
  });

  it("writes a business name with & or < as text, not HTML", () => {
    const [, who] = privacyPageContent(siteWith([], { businessName: "Fish & <Chips>" }));
    expect(who?.props.text).toBe("<p>This website is run by Fish &amp; &lt;Chips&gt;.</p>");
  });

  it("adds the page as one undo step, marked as the privacy page, and shows it", () => {
    const session = sessionWith(siteWith([contactForm]));
    const site = () => session.history.document.getState();
    const before = failing(site());
    expect(before).toContain("privacyPage");

    const id = addPrivacyPage(session);
    // Nothing else on the new page needs fixing: a main heading, a title, a description.
    const added = failing(site()).filter((rule) => !before.includes(rule));
    expect(added.filter((rule) => rule !== "placeholders")).toEqual([]);

    expect(site().pages[id]).toMatchObject({
      title: t("privacyPage.title"),
      slug: "privacy",
      settings: { description: t("privacyPage.description"), privacy: true },
    });
    expect(siteDocSchema.parse(site())).toEqual(site());
    expect(session.ui.getState().pageId).toBe(id);
    expect(session.history.entries().map((entry) => entry.label)).toEqual(["Added page 'Privacy'"]);
    // Site Check no longer asks for a privacy page; it finds the note left for the owner, which
    // publishing won't take until it's gone.
    expect(failing(site())).not.toContain("privacyPage");
    expect(failing(site())).toContain("placeholders");

    session.history.undo();
    expect(site().pages[id]).toBeUndefined();
  });

  it("marks or unmarks a page as the privacy page in Page Settings, and keeps it otherwise", () => {
    const session = sessionWith(siteWith([contactForm]));
    const site = () => session.history.document.getState();
    const id = addPrivacyPage(session);
    const page = () => site().pages[id as PageId];
    const settings = {
      title: "Privacy",
      slug: "privacy",
      description: "",
      shareImage: undefined,
      hideHeader: false,
      hideFooter: false,
      hideFromNavigation: false,
      hideBackToTop: false,
    };

    changePageSettings(session, id, { ...settings, title: "Your privacy" });
    expect(page()?.settings.privacy).toBe(true);

    changePageSettings(session, id, { ...settings, privacy: false });
    expect(page()?.settings).not.toHaveProperty("privacy");
    expect(failing(site())).toContain("privacyPage");

    changePageSettings(session, site().homePageId, { ...settings, title: "Home", privacy: true });
    expect(site().pages[site().homePageId]?.settings.privacy).toBe(true);
    expect(failing(site())).not.toContain("privacyPage");
  });
});
