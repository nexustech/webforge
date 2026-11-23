import type { StoreApi } from "zustand/vanilla";
import type { VersionSummary } from "../../shared/ipc/versions.js";
import type { SiteWideAction } from "../shell/confirm-site-wide.js";

// Version History's list and actions as the window's areas see them (4.6): Version History makes
// them, and AI apps' While you were away restores with them (5.36). Here, in editor/, so the
// service that shares them names no area (`renderer-editor-imports-no-area`).

/** What the Version History panel shows: the site's versions once main has listed them. */
export type VersionListState =
  | { readonly status: "loading" }
  | { readonly status: "failed" }
  | {
      readonly status: "ready";
      /** Newest first. */
      readonly versions: readonly VersionSummary[];
      /** What all of them keep that the site itself doesn't. */
      readonly bytes: number;
    };

/** The open site's versions, listed again after each change to them. */
export type VersionList = {
  readonly state: StoreApi<VersionListState>;
  /** Lists the versions again; resolves once the newest listing is shown. */
  refresh(): Promise<void>;
};

/** What the Version History panel and its commands do. */
export type VersionActions = {
  /**
   * Shows `version`'s site in the browser as it was, read-only, at the page the editor shows (or
   * its home page); true once opened.
   */
  preview(version: VersionSummary): Promise<boolean>;
  /** Saves the person's own version, named `name` (Save Version…); true once saved. */
  save(name: string): Promise<boolean>;
  /**
   * Restores `version` as one undo step, "Restored version '…'", once a version of the site as it
   * is now is saved; true once restored.
   */
  restore(version: VersionSummary): Promise<boolean>;
  /** Republishes `version` (4.6b): the site's destinations open, to choose where. */
  republish(version: VersionSummary): void;
  /** Deletes `version`; true once deleted. */
  remove(version: VersionSummary): Promise<boolean>;
  /** Opens `version` as a new site where the person chooses (P5), which replaces this one. */
  openAsNewSite(version: VersionSummary): Promise<void>;
  /**
   * Clean up (P3): removes what nothing needs any more and gives the space back to the disk,
   * saying it's working meanwhile; true once done.
   */
  cleanUp(): Promise<boolean>;
  /**
   * The automatic version before a change to every page (`setBeforeSiteWideAction`, A21): one for
   * each action the person confirms, named after it, and one before the first theme change that
   * asks no question in each opening of the site.
   */
  beforeSiteWide(action: SiteWideAction, options: { readonly asked: boolean }): Promise<void>;
};
