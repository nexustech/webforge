import { t } from "@webforge/i18n";
import { type NodeDoc, type PageId, type SiteDoc, siteDocSchema } from "@webforge/model";
import { checkSite } from "@webforge/site-check";
import { CATALOGUE } from "@webforge/site-components/catalogue-data";
import { describe, expect, it } from "vitest";
import { starterSite } from "../../shared/starter-site.js";
import { sessionWith } from "../testing/fixtures.js";
import { cookiePageContent, offersCookiePolicy } from "./cookie-page.js";
import { addPolicyPage } from "./page-actions.js";
import { termsPageContent } from "./terms-page.js";

/** The starter site with `content` on its home page, and Site Settings' `contact` and `analytics`. */
function siteWith(
  content: NodeDoc[] = [],
  settings: {
    readonly contact?: Partial<SiteDoc["settings"]["contact"]>;
    readonly measurementId?: string;
    readonly consentBanner?: boolean;
  } = {},
): SiteDoc {
  const site = starterSite();
  site.pages[site.homePageId]?.doc.content.push(...content);
  Object.assign(site.settings.contact, settings.contact);
  if (settings.measurementId !== undefined) {
    site.settings.analytics.measurementId = settings.measurementId;
  }
  if (settings.consentBanner !== undefined) {
    site.settings.analytics.consentBanner = settings.consentBanner;
  }
  return site;
}

/** Each section's title and its paragraphs' text, as the page shows them: a Hero's text is plain. */
const sectionsOf = (content: readonly NodeDoc[]) =>
  content.map((node) => ({
    title: node.props.title,
    text: String(node.props.text)
      .split("</p>")
      .filter((part) => part !== "")
      .map((part) => part.replace(/^<p>/, "")),
  }));

/** The page's opening section, `id`: its main heading `title`, and the note to the owner. */
const opening = (id: string, title: string) => ({
  type: "Hero",
  props: {
    id,
    variant: "minimal",
    colors: "page",
    title,
    text: t("legalPage.note"),
    buttonLabel: "",
  },
});

/** The rules with a finding in `site`'s check for publishing. */
const failing = (site: SiteDoc) =>
  checkSite({ site, catalogue: CATALOGUE }, "publish")
    .results.filter((result) => result.findings.length > 0)
    .map((result) => result.rule);

/** The findings for publishing `site` that point at an element of page `pageId`. */
const findingsOn = (site: SiteDoc, pageId: PageId) =>
  checkSite({ site, catalogue: CATALOGUE }, "publish").results.flatMap((result) =>
    result.findings.flatMap((finding) =>
      finding.place?.kind === "element" && finding.place.on === pageId
        ? [{ rule: result.rule, nodeId: finding.place.nodeId }]
        : [],
    ),
  );

const video: NodeDoc = { type: "Video", props: { id: "watch" } };
const analytics = { measurementId: "G-ABC123DEF4" };

describe("the terms page (#866)", () => {
  it("is written from the business name, its address and its email", () => {
    const content = termsPageContent(
      siteWith([], {
        contact: {
          businessName: "Rosa's Bakery",
          address: "12 Mill Lane\n  Leeds\n\nLS1 4AB",
          email: "hello@rosas.example",
          phone: "0113 496 0000",
        },
      }),
    );

    expect(content[0]).toEqual(opening("terms", t("termsPage.title")));
    expect(sectionsOf(content)).toEqual([
      { title: t("termsPage.title"), text: [t("legalPage.note")] },
      {
        title: t("termsPage.whoTitle"),
        text: [
          t("termsPage.who", { business: "Rosa's Bakery" }),
          t("termsPage.address", { address: "12 Mill Lane, Leeds, LS1 4AB" }),
        ],
      },
      { title: t("termsPage.useTitle"), text: [t("termsPage.use"), t("termsPage.useCopy")] },
      { title: t("termsPage.pricesTitle"), text: [t("termsPage.prices")] },
      { title: t("termsPage.linksTitle"), text: [t("termsPage.links")] },
      { title: t("termsPage.changesTitle"), text: [t("termsPage.changes")] },
      {
        title: t("termsPage.contactTitle"),
        text: [t("termsPage.contactEmail", { email: "hello@rosas.example" })],
      },
    ]);
  });

  it("falls back to the site's name, no address, then the phone or the site's details", () => {
    const site = siteWith([], { contact: { phone: "0113 496 0000" } });
    const sections = sectionsOf(termsPageContent(site));

    expect(sections[1]?.text).toEqual([
      t("termsPage.who", { business: site.settings.general.name }),
    ]);
    expect(sections.at(-1)?.text).toEqual([
      t("termsPage.contactPhone", { phone: "0113 496 0000" }),
    ]);
    expect(sectionsOf(termsPageContent(siteWith())).at(-1)?.text).toEqual([
      t("termsPage.contactOther"),
    ]);
  });

  it("writes a business name or an address with & or < as text, not HTML", () => {
    const [, who] = termsPageContent(
      siteWith([], { contact: { businessName: "Fish & <Chips>", address: "1 A&B Street" } }),
    );
    expect(who?.props.text).toBe(
      "<p>This website is run by Fish &amp; &lt;Chips&gt;.</p><p>Our address is 1 A&amp;B Street.</p>",
    );
  });
});

describe("the cookie policy (#866)", () => {
  it("is offered only while Google Analytics has a Measurement ID", () => {
    expect(offersCookiePolicy(siteWith())).toBe(false);
    expect(offersCookiePolicy(siteWith([], analytics))).toBe(true);
  });

  it("says Google Analytics' cookies wait for the visitor to agree, and how to change their mind", () => {
    const content = cookiePageContent(
      siteWith([], { ...analytics, contact: { email: "hello@rosas.example" } }),
    );

    expect(content[0]).toEqual(opening("cookies", t("cookiePage.title")));
    expect(sectionsOf(content)).toEqual([
      { title: t("cookiePage.title"), text: [t("legalPage.note")] },
      { title: t("cookiePage.whatTitle"), text: [t("cookiePage.what")] },
      {
        title: t("cookiePage.oursTitle"),
        text: [t("cookiePage.analyticsConsent"), t("cookiePage.choiceKept")],
      },
      {
        title: t("cookiePage.changeTitle"),
        text: [
          t("cookiePage.changeSettings", { settings: t("siteText.consent.settings") }),
          t("cookiePage.changeBrowser"),
        ],
      },
      {
        title: t("cookiePage.contactTitle"),
        text: [t("cookiePage.contactEmail", { email: "hello@rosas.example" })],
      },
    ]);
    // The Footer's link and the banner's button, as visitors see them.
    expect(sectionsOf(content)[3]?.text[0]).toContain("Cookie settings");
  });

  it("says visits are counted without cookies when the site has no banner", () => {
    const sections = sectionsOf(
      cookiePageContent(siteWith([], { ...analytics, consentBanner: false })),
    );

    expect(sections[2]?.text).toEqual([t("cookiePage.analyticsCookieless")]);
    expect(sections[3]?.text).toEqual([t("cookiePage.changeBrowser")]);
    expect(sections[4]?.text).toEqual([t("cookiePage.contactOther")]);
  });

  it("says videos and maps from other sites may set their own cookies, once they load", () => {
    const asked = sectionsOf(cookiePageContent(siteWith([video], analytics)));
    expect(asked[3]).toEqual({
      title: t("cookiePage.embedsTitle"),
      text: [t("cookiePage.embedsConsent", { acceptAll: t("siteText.consent.accept") })],
    });
    expect(asked[3]?.text[0]).toContain("Accept all");

    const unasked = sectionsOf(
      cookiePageContent(siteWith([video], { ...analytics, consentBanner: false })),
    );
    expect(unasked[3]?.text).toEqual([t("cookiePage.embedsClick")]);
  });

  it("says the site sets no cookies once Google Analytics is off", () => {
    expect(sectionsOf(cookiePageContent(siteWith()))[2]?.text).toEqual([t("cookiePage.none")]);
  });
});

describe("adding the terms page and the cookie policy (#866)", () => {
  it.each([
    ["terms", "termsPage", "terms"],
    ["cookies", "cookiePage", "cookies"],
  ] as const)("adds the %s page as one undo step, and shows it", (kind, strings, slug) => {
    const session = sessionWith(siteWith([], analytics));
    const site = () => session.history.document.getState();
    const before = failing(site());

    const id = addPolicyPage(session, kind);

    expect(site().pages[id]).toMatchObject({
      title: t(`${strings}.title`),
      slug,
      settings: { description: t(`${strings}.description`) },
    });
    expect(site().pages[id]?.settings).not.toHaveProperty("privacy");
    expect(siteDocSchema.parse(site())).toEqual(site());
    expect(session.ui.getState().pageId).toBe(id);
    expect(session.history.entries().map((entry) => entry.label)).toEqual([
      `Added page '${t(`${strings}.title`)}'`,
    ]);
    // Nothing else on the new page needs fixing; Site Check finds the note left for the owner, on
    // the page's opening section, which publishing won't take until it's gone.
    expect(failing(site()).filter((rule) => !before.includes(rule))).toEqual([]);
    expect(findingsOn(site(), id)).toEqual([{ rule: "placeholders", nodeId: kind }]);

    session.history.undo();
    expect(site().pages[id]).toBeUndefined();
  });
});
