import type { PageDoc, SiteSnapshot } from "@webforge/model";
import { starterLayout } from "@webforge/site-components";

/** The theme exported sites use until the Theme panel exists (Phase 2). */
const DEFAULT_THEME = "light";

/**
 * The snapshot to export while the editor holds a single page (Phase 0): that page as the home
 * page, with the starter Header and Footer. Phase 1 builds it from the open `.wforge` site.
 */
export function singlePageSnapshot(siteName: string, page: PageDoc): SiteSnapshot {
  return {
    name: siteName,
    language: "en",
    theme: { name: DEFAULT_THEME },
    layout: starterLayout(siteName),
    pages: [{ path: "index", title: siteName, doc: page }],
    media: [],
  };
}
