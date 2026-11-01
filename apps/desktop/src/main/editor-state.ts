import type { SiteUiChange, SiteUiState, UiStateResult } from "../shared/ipc-contract.js";
import { type SiteStore, storeFailure } from "./site-store.js";

/** The open site's editor state, or `null` without an open site. */
export function uiState(site: SiteStore): Promise<SiteUiState | null> {
  return site.withStore(
    "shared",
    (store) => ({
      editorMode: store.readEditorMode(),
      siteCheckIgnored: store.readSiteCheckIgnored(),
    }),
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
