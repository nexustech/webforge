import type { ElementPlace, MediaId, PageId, SiteDoc } from "@webforge/model";
import type { Catalogue } from "@webforge/site-components/catalogue-data";

/**
 * How much a finding matters (X5), as Site Check groups them: *Must fix* stops an export (or a
 * publish), *Should fix* is worth doing first, a *Tip* is a suggestion.
 */
export type CheckLevel = "must" | "should" | "tip";

/** What the site is checked for (X5): an export, or a publish, which is stricter. */
export type CheckMode = "export" | "publish";

/** Where a finding is, for Site Check to jump there. */
export type FindingPlace =
  /** An element: on a page, in the Header or Footer, or in a shared section. */
  | { readonly kind: "element"; readonly on: ElementPlace; readonly nodeId: string }
  /** An item of the navigation menu. */
  | { readonly kind: "menu"; readonly itemId: string }
  /** A page itself: its name, title or folder (Page Settings). */
  | { readonly kind: "page"; readonly pageId: PageId }
  /** The site's pages as a whole: the Pages panel (a privacy page missing, #855). */
  | { readonly kind: "pages" }
  /** An item in Media. */
  | { readonly kind: "media"; readonly mediaId: MediaId }
  /** The theme's colours. */
  | { readonly kind: "theme" }
  /** The web address in Site Settings. */
  | { readonly kind: "address" }
  /** A part of the site's own code, in Settings' Custom Code (3.9). */
  | { readonly kind: "code"; readonly part: SiteCodePart }
  /** A detail of the business in Site Settings' Contact section (3.17). */
  | { readonly kind: "contact"; readonly field: ContactField }
  /** Site Settings' Search engines section (3.17). */
  | { readonly kind: "search" }
  /** Something only the person can do, on another website (3.17): see {@link SearchGuide}. */
  | { readonly kind: "guide"; readonly guide: SearchGuide };

/** A detail of the business that search engines show with it (3.15's structured data). */
export type ContactField = "address" | "phone" | "openingHours";

/**
 * A step only the person can take, outside Webforge (3.17, SEO-7): setting up or checking the
 * business's Google Business Profile, and verifying the site in Google Search Console.
 */
export type SearchGuide = "businessProfile" | "searchConsole";

/** A part of the site's own code (`SiteCode`): its stylesheet, its script, or its page HTML. */
export type SiteCodePart = "css" | "js" | "head" | "bodyEnd";

/** One thing a rule found. */
export type Finding = {
  /**
   * Stable while the problem lasts, and unique in its rule: what *Ignore* remembers. Usually the
   * place and what is wrong there.
   */
  readonly key: string;
  readonly place: FindingPlace;
  /** What the panel's line needs besides the place: a ratio, a size, a name. */
  readonly values?: Readonly<Record<string, string | number>>;
};

/** What every rule reads: the site, and the components it is built from as data. */
export type CheckInput = {
  readonly site: SiteDoc;
  readonly catalogue: Catalogue;
  /**
   * Whether the owner has confirmed the addresses Settings' Custom Code allows (#649, S1). The
   * list is stored in the site's file, which may come from anyone, so until then it allows nothing:
   * a file can't pass its own scripts' addresses.
   */
  readonly allowListConfirmed?: boolean;
  /**
   * The year the site was last published in, and this year (F-CM-8): a published site shows
   * `{year}` as the year it was published in until it's published again. Left out when it hasn't
   * been published, or isn't known.
   */
  readonly published?: { readonly year: number; readonly thisYear: number };
  /**
   * The SHA-256 of every picture the shipped templates come with (4.12b), from
   * `@webforge/templates`: an image with one is still a template's placeholder. Left out, none is.
   */
  readonly templateImages?: ReadonlySet<string>;
  /**
   * Where the site is published to, for a publish to Netlify (4.2): Netlify Forms send only from a
   * site Netlify serves. Left out for an export, and for any other host.
   */
  readonly host?: "netlify";
};

/** One Site Check rule (F-CHK-1): its level, and what it finds in a site. */
export type CheckRule = {
  /** Unique; names its text in the panel (`siteCheck.rule.<id>`). */
  readonly id: string;
  readonly level: CheckLevel;
  /** *Must fix* when publishing (X5's publish-strict rules), whatever its level for an export. */
  readonly strictOnPublish?: true;
  /** *Being found* (3.17, SEO-7): what stops people finding the site, a group of its own. */
  readonly group?: "found";
  /**
   * A one-time tip (3.17): listed only while it has something to say, and its finding is
   * *Done* rather than ignored.
   */
  readonly oneTime?: true;
  /**
   * Given the whole site, draft pages included (G37, #864). Every other rule is given the site as
   * it is published ({@link runRule}), so nothing on a draft page is checked. A rule with this
   * leaves out what isn't published itself: it is for links to a draft page.
   */
  readonly drafts?: true;
  readonly check: (input: CheckInput) => readonly Finding[];
};

/** A rule's outcome in one check: what it found, and how much that matters in this mode. */
export type RuleResult = {
  readonly rule: string;
  readonly level: CheckLevel;
  /** The rule's group, if it has one. */
  readonly group?: "found";
  /** A one-time tip: see {@link CheckRule.oneTime}. */
  readonly oneTime?: true;
  /** What it found, but not what the person ignored. */
  readonly findings: readonly Finding[];
  /** How many of its findings the person ignored. */
  readonly ignored: number;
};

/** A whole check (F-CHK-1): every rule's result, in the registry's order. */
export type CheckReport = {
  readonly mode: CheckMode;
  readonly results: readonly RuleResult[];
};
