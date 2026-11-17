import { type SiteText, siteTextFor } from "@webforge/i18n";
import type { SiteSnapshot } from "@webforge/model";

/**
 * The site's own labels in its language (6.12, CC-1), English for one its language lacks: what its
 * elements and the pages the export makes itself ("Thank you", a Blog's tag pages) say.
 */
export const siteTextOf = (site: Pick<SiteSnapshot, "language">): SiteText =>
  siteTextFor(site.language);
