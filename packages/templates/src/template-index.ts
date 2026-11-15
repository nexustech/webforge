// Generated from the folders of `packages/templates/templates/` by `pnpm template-index`
// (tools/src/build-template-index.ts): don't edit it by hand. A test checks that it matches them.

import blankImages from "../templates/blank/images.json" with { type: "json" };
import cafeImages from "../templates/cafe/images.json" with { type: "json" };
import consultantImages from "../templates/consultant/images.json" with { type: "json" };
import personalImages from "../templates/personal/images.json" with { type: "json" };
import photographerImages from "../templates/photographer/images.json" with { type: "json" };
import salonImages from "../templates/salon/images.json" with { type: "json" };
import shopImages from "../templates/shop/images.json" with { type: "json" };
import tradesImages from "../templates/trades/images.json" with { type: "json" };

/**
 * The templates Webforge ships (2.14a, F-SITE-1, S2), by id: each a folder of this package's
 * `templates/` with its `template.json` and `images.json`, in New Site's order: by business type,
 * as `BUSINESS_TYPES` lists them, then Blank. Their names and descriptions are
 * `t("template.<id>.name")` and `t("template.<id>.description")`.
 */
export const TEMPLATE_IDS = [
  "cafe",
  "salon",
  "trades",
  "consultant",
  "photographer",
  "shop",
  "personal",
  "blank",
] as const;

/** Each template's image manifest (`images.json`), by id. */
export const TEMPLATE_MANIFESTS = {
  blank: blankImages,
  cafe: cafeImages,
  consultant: consultantImages,
  personal: personalImages,
  photographer: photographerImages,
  salon: salonImages,
  shop: shopImages,
  trades: tradesImages,
};
