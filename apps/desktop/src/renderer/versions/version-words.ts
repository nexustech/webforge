import { type MessageKey, t } from "@webforge/i18n";
import { SITE_NAME_MAX } from "@webforge/model";
import type { VersionSummary } from "../../shared/ipc/versions.js";

/** What a version {appName} saved is called, by why it saved it. */
const REASON_NAMES = {
  manual: "versionHistory.reason.manual",
  daily: "versionHistory.reason.daily",
  "before-restore": "versionHistory.reason.beforeRestore",
  "before-site-wide": "versionHistory.reason.beforeSiteWide",
  "on-publish": "versionHistory.reason.onPublish",
} as const satisfies Record<VersionSummary["reason"], MessageKey>;

/** What the panel calls a version: the name it was saved with, or why {appName} saved it. */
export const versionName = (version: Pick<VersionSummary, "name" | "reason">): string =>
  version.name === "" ? t(REASON_NAMES[version.reason]) : version.name;

/**
 * `text` cut to at most `max` UTF-16 units, as the schemas count a string's length, never inside a
 * character.
 */
export function fit(text: string, max: number): string {
  let out = "";
  for (const character of text) {
    if (out.length + character.length > max) break;
    out += character;
  }
  return out;
}

/**
 * The name Open as New Site offers for a version's site: "Rosa's Bakery (Before the menu)", the
 * version's part cut short ("…") so it fits a site's name.
 */
export function newSiteName(site: string, version: string): string {
  const full = t("versionHistory.newSiteName", { site, version });
  const over = full.length - SITE_NAME_MAX;
  if (over <= 0) return full;
  const room = version.length - over - 1;
  return room > 0
    ? t("versionHistory.newSiteName", { site, version: `${fit(version, room).trimEnd()}…` })
    : fit(site, SITE_NAME_MAX).trim();
}

/** `at` (ISO 8601) as the person's computer writes a date and time ("6 Nov 2026, 20:41"). */
const dateTime = (at: string, locale?: string): string =>
  new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(at));

/** When a version was saved, as the person's computer writes a date and time ("6 Nov 2026, 20:41"). */
export const versionDate = (version: Pick<VersionSummary, "createdAt">, locale?: string): string =>
  dateTime(version.createdAt, locale);

/**
 * Where and when a version was last published (4.6b): "Published to My host, 6 Nov 2026, 20:41",
 * or without the destination once it's been removed; undefined for one never published.
 */
export function versionPublished(
  version: Pick<VersionSummary, "published">,
  locale?: string,
): string | undefined {
  const { published } = version;
  if (published === undefined) return undefined;
  const date = dateTime(published.at, locale);
  return published.to === undefined
    ? t("versionHistory.publishedOn", { date })
    : t("versionHistory.publishedTo", { destination: published.to, date });
}
