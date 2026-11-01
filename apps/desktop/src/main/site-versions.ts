import {
  ReadOnlyProjectError,
  type SaveVersionOptions,
  type VersionInfo,
  type VersionReason,
} from "@webforge/storage";
import { logFailure } from "./log.js";
import type { SiteStore, StaleReason } from "./site-store.js";

/** What became of saving a version: saved, or why not. */
export type SavedVersion =
  | { readonly status: "saved"; readonly version: VersionInfo }
  | { readonly status: "failed"; readonly reason: "read-only" | "unknown" | StaleReason };

/**
 * Saves a version of the open site (storage format 2, #664): the one path main saves every version
 * by, the "Published …" one (4.5) and Version History's (4.6a). `options.documents` is a manifest
 * read earlier with the site it was built from (ADR 0018 §3); the documents as stored now without
 * it. A read-only site saves none, said as it is; anything else is logged by its code only.
 */
export function saveSiteVersion(
  site: Pick<SiteStore, "withStore">,
  name: string,
  reason: VersionReason,
  options: SaveVersionOptions = {},
): Promise<SavedVersion> {
  return site.withStore<SavedVersion>(
    "shared",
    (store) => {
      try {
        return { status: "saved", version: store.saveVersion(name, reason, options) };
      } catch (error) {
        if (error instanceof ReadOnlyProjectError) return { status: "failed", reason: "read-only" };
        logFailure("Webforge could not save a version", error);
        return { status: "failed", reason: "unknown" };
      }
    },
    (stale) => ({ status: "failed", reason: stale }),
  );
}
