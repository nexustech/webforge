import { t } from "@webforge/i18n";
import { SITE_TEXT_KEYS, type SiteTextKey, siteTextFor } from "@webforge/i18n/site-text";
import { CONSENT_MESSAGE_LABEL } from "@webforge/model";

/** Where on the site a label shows, as *Labels on your site* groups them (6.12). */
type LabelPlace =
  | "announcement"
  | "backToTop"
  | "blog"
  | "carousel"
  | "consent"
  | "contact"
  | "embed"
  | "forms"
  | "logos"
  | "menu"
  | "moved"
  | "pictures";

/** Each label's place, by the start of its key; the first that matches. */
const PLACES: readonly (readonly [RegExp, LabelPlace])[] = [
  [/^siteText\.announcement\./, "announcement"],
  [/^siteText\.backToTop$/, "backToTop"],
  [
    /^siteText\.(noPosts|allPosts|newerPosts|olderPosts|postPages|postsTagged|blogPage|postTags)$/,
    "blog",
  ],
  [
    /^siteText\.(carousel|slide|slideOf|slidesOf|slides|previousSlide|nextSlide|stopSlides|startSlides)$/,
    "carousel",
  ],
  [/^siteText\.consent\./, "consent"],
  [/^siteText\.(openingHours|contactUs|phone|email|address|days?\.)/, "contact"],
  [/^siteText\.embed\./, "embed"],
  [/^siteText\.(form|thanks)\./, "forms"],
  [/^siteText\.logo$/, "logos"],
  [/^siteText\.(navigation|menu|footerNavigation)$/, "menu"],
  [/^siteText\.redirect\./, "moved"],
  [
    /^siteText\.(lightbox|imageOf|close|previousImage|nextImage|openLarger|galleryImage|openLargerPicture)/,
    "pictures",
  ],
];

/** Where `key` shows on the site; `undefined` only for a key no pattern names (a test checks). */
export function labelPlace(key: SiteTextKey): LabelPlace | undefined {
  return PLACES.find(([pattern]) => pattern.test(key))?.[1];
}

/** The labels *Labels on your site* offers: all but the cookie banner's text, under Analytics. */
export const CHANGEABLE_LABELS: readonly SiteTextKey[] = SITE_TEXT_KEYS.filter(
  (key) => key !== CONSENT_MESSAGE_LABEL,
);

/**
 * The labels to choose from, for a site in `language`: where each shows and its words in that
 * language now ("Forms: Name"), placeholders left in, by place and then the catalogue's order.
 */
export function labelOptions(
  language: string,
): readonly { readonly label: string; readonly value: SiteTextKey }[] {
  const words = siteTextFor(language) as (key: SiteTextKey) => string;
  return CHANGEABLE_LABELS.map((key) => {
    const place = labelPlace(key);
    return {
      place: place === undefined ? "" : t(`site.settings.labelPlace.${place}`),
      key,
    };
  })
    .sort((a, b) => a.place.localeCompare(b.place, "en"))
    .map(({ place, key }) => ({
      label: t("site.settings.labelOption", { place, label: words(key) }),
      value: key,
    }));
}
