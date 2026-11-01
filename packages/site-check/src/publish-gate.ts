import type { SiteDoc } from "@webforge/model";
import { CATALOGUE } from "@webforge/site-components/catalogue-data";
import { blockingCount, checkSite } from "./check.js";

/**
 * How many *Must fix* findings stop `site` from being published (ADR 0018 §4, A6): Site Check in
 * publish mode, where broken links, placeholders, forms, page titles and the web address must be
 * fixed too. The main process runs it on the site it is about to build, before saving anything or
 * starting the build, so neither a renderer that skipped its own check nor a stored version that
 * never passed one can be published (X5). `allowListConfirmed` as for {@link checkSite}: whether
 * the site's owner confirmed its allowed external addresses on this computer (#649).
 */
export function publishGate(
  site: SiteDoc,
  options: { readonly allowListConfirmed?: boolean } = {},
): number {
  const input =
    options.allowListConfirmed === true
      ? { site, catalogue: CATALOGUE, allowListConfirmed: true }
      : { site, catalogue: CATALOGUE };
  return blockingCount(checkSite(input, "publish"));
}
