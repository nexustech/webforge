import { type MessageKey, t } from "@webforge/i18n";
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

/** When a version was saved, as the person's computer writes a date and time ("6 Nov 2026, 20:41"). */
export const versionDate = (version: Pick<VersionSummary, "createdAt">, locale?: string): string =>
  new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(version.createdAt),
  );
