import { eachElement, type SiteDoc } from "@webforge/model";
import { exportedPlaces } from "../fields.js";
import type { CheckRule } from "../types.js";

/** What a site collects from its visitors, for its privacy page to say (#855, PH5-1). */
export type SiteCollects = {
  /** A Contact form or Form: what a visitor writes, with their name, email and phone (3.7). */
  readonly messages: boolean;
  /** A Newsletter signup: an email address, and a name if it asks for one. */
  readonly signups: boolean;
  /** Google Analytics counts visits (B4, B7). */
  readonly visits: boolean;
};

const MESSAGE_FORMS = new Set(["ContactForm", "Form"]);

/** Videos and maps from another site: they load when the visitor asks, or accepts all (B7). */
const EMBEDS = new Set(["Video", "Map", "EmbedVideo", "EmbedMap"]);

/**
 * The kinds of section and element the export draws for `site`: not hidden, and not in a shared
 * section no page holds.
 */
function exportedTypes(site: SiteDoc): ReadonlySet<string> {
  const exported = exportedPlaces(site);
  const types = new Set<string>();
  eachElement(
    site,
    (node, on) => {
      if (exported(on)) types.add(node.type);
    },
    { skipHidden: true },
  );
  return types;
}

const hasAny = (types: ReadonlySet<string>, of: ReadonlySet<string>) =>
  [...of].some((type) => types.has(type));

/**
 * What `site` collects from its visitors: the forms the export draws, and Google Analytics once it
 * has a Measurement ID.
 */
export function siteCollects(site: SiteDoc): SiteCollects {
  const types = exportedTypes(site);
  return {
    messages: hasAny(types, MESSAGE_FORMS),
    signups: types.has("Newsletter"),
    visits: site.settings.analytics.measurementId !== undefined,
  };
}

/**
 * Whether the export draws a video (YouTube, Vimeo) or a map for `site`, whose site may set its
 * own cookies once it loads: what its cookie policy says (#866).
 */
export function siteEmbeds(site: SiteDoc): boolean {
  return hasAny(exportedTypes(site), EMBEDS);
}

/** Whether `site` has a page marked as its privacy page (Page Settings, or *Add Page › Privacy Page*). */
export function hasPrivacyPage(site: SiteDoc): boolean {
  return site.pageOrder.some((id) => {
    const page = site.pages[id];
    return page?.kind === "page" && page.settings.privacy === true;
  });
}

/**
 * A site that collects visitors' details (a form, a Newsletter or Google Analytics) with no privacy
 * page to say what it does with them (#855, PH5-1, G20). *Should fix*: its *Fix* adds one, filled
 * in from Site Settings. One finding for the site.
 */
export const privacyPageRule: CheckRule = {
  id: "privacyPage",
  level: "should",
  check: ({ site }) => {
    const { messages, signups, visits } = siteCollects(site);
    if (!(messages || signups || visits) || hasPrivacyPage(site)) return [];
    return [{ key: "privacyPage", place: { kind: "pages" } }];
  },
};
