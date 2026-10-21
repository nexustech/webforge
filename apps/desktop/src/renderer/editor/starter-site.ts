import { t } from "@webforge/i18n";
import { createSite, type PageDoc, type SiteDoc } from "@webforge/model";
import { starterLayout, starterNotFoundPage, starterPage } from "@webforge/site-components";

/**
 * The site the editor opens with until sites are created and opened from the start screen (1.8):
 * the starter page as the home page, the starter Header and Footer, and a "Page not found" page
 * with a short message (F-ED-20).
 */
export function starterSite(homeDoc: PageDoc = starterPage()): SiteDoc {
  const name = t("site.untitledName");
  return createSite({
    name,
    language: "en",
    homeTitle: name,
    notFoundTitle: t("starter.notFoundTitle"),
    homeDoc,
    notFoundDoc: starterNotFoundPage(),
    layout: starterLayout(name),
  });
}
