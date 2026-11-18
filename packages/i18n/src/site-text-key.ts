import type { ComponentMessageKey, ComponentParamsArg } from "./components.js";

/**
 * A label of the exported site itself (6.12, CC-1): "Menu", "Accept all", "Monday". Written in
 * the site's language, not the app's; the English catalogue has every one.
 */
export type SiteTextKey = Extract<ComponentMessageKey, `siteText.${string}`>;

/** A language's labels of the exported site, any of which may be missing. */
export type SiteTextCatalogue = Partial<Readonly<Record<SiteTextKey, string>>>;

/**
 * A site's labels in its language: `siteText("siteText.slideOf", { n: 2, total: 5 })`. Params are
 * checked against the English message's placeholders, which every language's message shares.
 */
export type SiteText = <K extends SiteTextKey>(key: K, ...params: ComponentParamsArg<K>) => string;
