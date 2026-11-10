import type { PageId, SiteDoc } from "@webforge/model";
import { describe, expect, it } from "vitest";
import { levelIn } from "../check.js";
import { element, findIn, siteWith } from "../test-site.test-helper.js";
import { hasPrivacyPage, privacyPageRule, siteCollects, siteEmbeds } from "./privacy.js";

/** `site` with Google Analytics' Measurement ID. */
const withAnalytics = (site: SiteDoc): SiteDoc => ({
  ...site,
  settings: {
    ...site.settings,
    analytics: { ...site.settings.analytics, measurementId: "G-ABC123DEF4" },
  },
});

/** `site` with its home page marked as the privacy page, or `privacy` as given. */
const markHome = (site: SiteDoc, privacy = true): SiteDoc => {
  const home = site.pages[site.homePageId];
  if (home === undefined) throw new Error("no home page");
  return {
    ...site,
    pages: {
      ...site.pages,
      [site.homePageId]: { ...home, settings: { ...home.settings, privacy } },
    },
  };
};

const MISSING = [{ key: "privacyPage", place: { kind: "pages" } }];

describe("privacy page (#855, PH5-1)", () => {
  it("asks for one when a form collects visitors' details, as Should fix", () => {
    for (const form of ["ContactForm", "Form", "Newsletter"]) {
      expect(findIn(privacyPageRule, siteWith([element(form, "ask")]))).toEqual(MISSING);
    }
    expect(levelIn(privacyPageRule, "export")).toBe("should");
    expect(levelIn(privacyPageRule, "publish")).toBe("should");
  });

  it("asks for one when Google Analytics counts visits", () => {
    expect(findIn(privacyPageRule, withAnalytics(siteWith()))).toEqual(MISSING);
  });

  it("asks for nothing on a site that collects nothing", () => {
    expect(findIn(privacyPageRule, siteWith([element("TextSection", "about")]))).toEqual([]);
  });

  it("is content with a page marked as the privacy page, and only a marked one", () => {
    const site = withAnalytics(siteWith([element("ContactForm", "write")]));

    expect(findIn(privacyPageRule, markHome(site))).toEqual([]);
    expect(hasPrivacyPage(markHome(site))).toBe(true);
    expect(findIn(privacyPageRule, markHome(site, false))).toEqual(MISSING);
  });

  it("doesn't count a hidden form, or 'Page not found' marked as the privacy page", () => {
    const hidden = element("ContactForm", "write", { hidden: true });
    expect(findIn(privacyPageRule, siteWith([hidden]))).toEqual([]);

    const site = withAnalytics(siteWith());
    const notFound = site.pageOrder.find((id) => site.pages[id]?.kind === "not-found") as PageId;
    const page = site.pages[notFound];
    if (page === undefined) throw new Error("no 'Page not found'");
    const marked = {
      ...site,
      pages: {
        ...site.pages,
        [notFound]: { ...page, settings: { ...page.settings, privacy: true } },
      },
    };
    expect(hasPrivacyPage(marked)).toBe(false);
  });

  it("says what a site collects, for its privacy page to say", () => {
    expect(siteCollects(siteWith([element("ContactForm", "write")]))).toEqual({
      messages: true,
      signups: false,
      visits: false,
    });
    expect(siteCollects(withAnalytics(siteWith([element("Newsletter", "news")])))).toEqual({
      messages: false,
      signups: true,
      visits: true,
    });
  });

  it("says whether the site has a video or a map, for its cookie policy to say (#866)", () => {
    for (const embed of ["Video", "Map", "EmbedVideo", "EmbedMap"]) {
      expect(siteEmbeds(siteWith([element(embed, "watch")])), embed).toBe(true);
    }
    expect(siteEmbeds(siteWith([element("Video", "watch", { hidden: true })]))).toBe(false);
    expect(siteEmbeds(siteWith([element("ContactForm", "write")]))).toBe(false);
  });
});
