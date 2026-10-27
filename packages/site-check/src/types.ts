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
  /** An item in Media. */
  | { readonly kind: "media"; readonly mediaId: MediaId }
  /** The theme's colours. */
  | { readonly kind: "theme" }
  /** The web address in Site Settings. */
  | { readonly kind: "address" };

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
};

/** One Site Check rule (F-CHK-1): its level, and what it finds in a site. */
export type CheckRule = {
  /** Unique; names its text in the panel (`siteCheck.rule.<id>`). */
  readonly id: string;
  readonly level: CheckLevel;
  /** *Must fix* when publishing (X5's publish-strict rules), whatever its level for an export. */
  readonly strictOnPublish?: true;
  readonly check: (input: CheckInput) => readonly Finding[];
};

/** A rule's outcome in one check: what it found, and how much that matters in this mode. */
export type RuleResult = {
  readonly rule: string;
  readonly level: CheckLevel;
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
