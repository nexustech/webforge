import type { SiteDoc } from "@webforge/model";
import type { ProjectApi } from "../../shared/ipc/project.js";
import { setSiteSession } from "./site-session.js";

/** The site the editor starts with, and whether it is saved to a `.wforge` file. */
export type LoadedSite =
  /** An open site file; `saved` is what the file holds (`undefined` while it is still empty). */
  | { readonly kind: "file"; readonly site: SiteDoc; readonly saved: SiteDoc | undefined }
  /** No site file is open, or it couldn't be read: the editor works on `site` in memory only. */
  | { readonly kind: "memory"; readonly site: SiteDoc };

/**
 * Reads the site that is open in the main process. A new, empty site file gets `newSite()` (the
 * starter site) as its first content, which autosave then writes. Without an open site the editor
 * still starts, with `newSite()` in memory, until the start screen (1.8) opens or creates one.
 * The open site's session is remembered for the calls that change it (`siteSession`, R6).
 */
export async function loadSite(
  project: Pick<ProjectApi, "getCurrent" | "readSite">,
  newSite: () => SiteDoc,
): Promise<LoadedSite> {
  const current = await project.getCurrent();
  setSiteSession(current?.sessionId);
  if (current === null) {
    return { kind: "memory", site: newSite() };
  }
  const result = await project.readSite();
  switch (result.status) {
    case "ok":
      return { kind: "file", site: result.site, saved: result.site };
    case "empty":
      return { kind: "file", site: newSite(), saved: undefined };
    default:
      // A site this build can't read (or one closed meanwhile) is never overwritten.
      return { kind: "memory", site: newSite() };
  }
}
