import { basename } from "node:path";
import { SiteZipError, writeSiteZip } from "@webforge/storage";
import type { SaveSiteZipResult } from "../shared/ipc-contract.js";
import { logFailure } from "./log.js";
import { samePath } from "./site-paths.js";
import type { SiteStore } from "./site-store.js";

/**
 * Saves a copy of the site as a ZIP at `path` (4.7, F-SITE-5), a file the person chose. The site is
 * read on the gate's shared side, so it can't close meanwhile, all at once, so the copy is the site
 * as it was then, whatever is saved while the ZIP is written.
 *
 * Never over the open site's own file or the files SQLite keeps beside it: on macOS and Linux the
 * ZIP's rename would replace the database the site is saved to (`own-file`). Once another site has
 * opened, nothing is saved (`canceled`, #663): the person asked for a copy of the one that has gone.
 */
export function saveSiteZip(site: SiteStore, path: string): Promise<SaveSiteZipResult> {
  if (site.staleReason() === "stale-session") {
    return Promise.resolve({ status: "canceled" });
  }
  const open = site.openPath();
  if (
    open !== undefined &&
    ["", "-wal", "-journal", "-shm"].some((suffix) => samePath(`${open}${suffix}`, path))
  ) {
    return Promise.resolve({ status: "failed", reason: "own-file" });
  }
  return site.withStore<SaveSiteZipResult>(
    "shared",
    async (store) => {
      try {
        await writeSiteZip(store, path);
        return { status: "saved", fileName: basename(path) };
      } catch (error) {
        if (error instanceof SiteZipError && error.code === "too-large") {
          return { status: "failed", reason: "too-large" };
        }
        logFailure("Webforge could not save a copy of a site as a ZIP", error);
        return { status: "failed", reason: "unknown" };
      }
    },
    (reason) =>
      reason === "stale-session" ? { status: "canceled" } : { status: "failed", reason },
  );
}
