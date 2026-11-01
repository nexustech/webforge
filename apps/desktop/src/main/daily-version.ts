import { ReadOnlyProjectError } from "@webforge/storage";
import type { AppFeature } from "./app-feature.js";
import { logFailure } from "./log.js";
import type { SiteStoreAccess } from "./project-session.js";
import { saveVersionIn } from "./site-versions.js";

/** The calendar day of `date` on this computer: `2026-11-01`. */
const localDay = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

/**
 * The daily version (F-SITE-4, P3): as a site opens, if Webforge hasn't saved one of it today, the
 * site as its file holds it is saved as a version, the oldest automatic ones past `versionsKept`
 * deleted. No picture: the canvas hasn't drawn it yet. A new, empty site and one from a newer
 * Webforge (read-only) get none, and a version that can't be saved never stops the site opening.
 */
export function dailyVersionFeature(options: { readonly versionsKept: () => number }): AppFeature {
  const take = async (access: SiteStoreAccess) => {
    try {
      await access((store) => {
        if (store.isEmpty()) return;
        // The clock versions are saved by.
        const today = localDay(new Date());
        const taken = store
          .listVersions()
          .some(
            (version) =>
              version.reason === "daily" && localDay(new Date(version.createdAt)) === today,
          );
        if (taken) return;
        saveVersionIn(store, {
          name: "",
          reason: "daily",
          thumbnail: undefined,
          kept: options.versionsKept(),
        });
      });
    } catch (error) {
      if (error instanceof ReadOnlyProjectError) return;
      logFailure("Webforge could not save the daily version of a site", error);
    }
  };
  return { site: { opened: (access) => take(access) } };
}
