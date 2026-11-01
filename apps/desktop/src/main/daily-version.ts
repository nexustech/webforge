import type { ProjectStore } from "@webforge/storage";
import { saveVersionIn } from "./site-versions.js";

/** The calendar day of `date` on this computer: `2026-11-01`. */
export const localDay = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

/**
 * The daily version (F-SITE-4, P3): taken just before the first change of the day is saved, so it
 * is the site as it was before that day's work, and a site only looked at is never written (R14,
 * #661). Saved unless Webforge already saved one of it today, with no name or picture (the canvas
 * may be mid-edit), the oldest automatic versions past `kept` then deleted. Gives whether it saved
 * one. A new, empty site has nothing to keep.
 */
export function takeDailyVersion(store: ProjectStore, kept: number): boolean {
  if (store.isEmpty()) return false;
  // The clock versions are saved by.
  const today = localDay(new Date());
  const taken = store
    .listVersions()
    .some(
      (version) => version.reason === "daily" && localDay(new Date(version.createdAt)) === today,
    );
  if (taken) return false;
  saveVersionIn(store, { name: "", reason: "daily", thumbnail: undefined, kept });
  return true;
}
