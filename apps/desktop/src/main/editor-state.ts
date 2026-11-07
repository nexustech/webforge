import type { ProjectStore } from "@webforge/storage";
import type { SiteUiChange, SiteUiState, UiStateResult } from "../shared/ipc-contract.js";
import { type SiteStore, storeFailure } from "./site-store.js";

/** When the site in `store` was last published, as its versions record it (4.5), if it has been. */
function lastPublishedAt(store: ProjectStore): string | undefined {
  let last: string | undefined;
  for (const { publishedTo } of store.listVersions()) {
    const at = publishedTo?.publishedAt;
    if (at !== undefined && (last === undefined || Date.parse(at) > Date.parse(last))) last = at;
  }
  return last;
}

/**
 * The open site's editor state, or `null` without an open site, with when it was last published
 * for Site Check (F-CM-8).
 */
export function uiState(site: SiteStore): Promise<SiteUiState | null> {
  return site.withStore(
    "shared",
    (store) => {
      const published = lastPublishedAt(store);
      return {
        editorMode: store.readEditorMode(),
        siteCheckIgnored: store.readSiteCheckIgnored(),
        ...(published === undefined ? {} : { lastPublishedAt: published }),
      };
    },
    () => null,
  );
}

/**
 * Remembers the parts of the editor state in `change` with the open site (not a site change:
 * never versioned).
 */
export function setUiState(site: SiteStore, change: SiteUiChange): Promise<UiStateResult> {
  return site.withStore<UiStateResult>(
    "shared",
    (store) => {
      try {
        if (change.editorMode !== undefined) store.writeEditorMode(change.editorMode);
        if (change.siteCheckIgnored !== undefined) {
          store.writeSiteCheckIgnored(change.siteCheckIgnored);
        }
        return { status: "saved" };
      } catch (error) {
        return storeFailure(error, "Webforge could not remember the editor state");
      }
    },
    (reason) => ({ status: "failed", reason }),
  );
}
