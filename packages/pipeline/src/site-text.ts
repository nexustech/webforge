import { type SiteText, siteTextFor } from "@webforge/i18n/site-text";
import type { SiteSnapshot } from "@webforge/model";

/**
 * The site's own labels (6.12, CC-1): in the owner's words where they changed one, else in its
 * language, and English for one its language lacks. What its elements and the pages the export
 * makes itself ("Thank you", a Blog's tag pages) say.
 */
export const siteTextOf = (site: Pick<SiteSnapshot, "language" | "labels">): SiteText =>
  siteTextFor(site.language, site.labels);
