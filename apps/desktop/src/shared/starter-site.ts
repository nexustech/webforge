import { t } from "@webforge/i18n";
import { createSite, type SiteDoc, type ThemeTokens } from "@webforge/model";
import { starterLayout, starterNotFoundPage, starterPage } from "@webforge/site-components";

/**
 * The Blank site (1.8, 2.14a): the starter page as the home page, the starter Header and Footer,
 * and a "Page not found" page with a short message (F-ED-20). Named `name` (the Header's site name
 * and the home page's title too) and in `theme`, as New Site asked; main writes it into a new site
 * and the editor starts from it when no site could be read.
 */
export function starterSite(
  options: { readonly name?: string; readonly theme?: ThemeTokens } = {},
): SiteDoc {
  const name = options.name ?? t("site.untitledName");
  return createSite({
    name,
    language: "en",
    homeTitle: name,
    notFoundTitle: t("starter.notFoundTitle"),
    homeDoc: starterPage(),
    notFoundDoc: starterNotFoundPage(),
    layout: starterLayout(name),
    ...(options.theme === undefined ? {} : { theme: options.theme }),
  });
}
