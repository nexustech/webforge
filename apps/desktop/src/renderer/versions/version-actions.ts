import { t } from "@webforge/i18n";
import { restoreSite, type SiteDoc } from "@webforge/model";
import { siteContentFor, siteWithCleanRichText } from "@webforge/site-components";
import type { PreviewApi } from "../../shared/ipc/preview.js";
import type { ProjectResult } from "../../shared/ipc/project.js";
import {
  VERSION_NAME_MAX,
  type VersionSummary,
  type VersionsApi,
} from "../../shared/ipc/versions.js";
import { openFailureMessage } from "../../shared/open-failure.js";
import type { EditorSession } from "../editor/editor-session.js";
import type { VersionToRepublish } from "../editor/publish-requests.js";
import type { EditorSelection } from "../editor/selection.js";
import { reportFailure } from "../log.js";
import { fileSizeLabel } from "../media/index.js";
import { previewPageOf } from "../preview/index.js";
import type { SiteWideAction } from "../shell/confirm-site-wide.js";
import type { VersionList } from "./version-list.js";
import { fit, newSiteName, versionName } from "./version-words.js";

/** What the person is told: a toast in the app. */
type VersionNotices = {
  readonly success: (message: string) => void;
  readonly error: (message: string) => void;
  /** Says something is under way until the returned function is called. */
  readonly working: (message: string) => () => void;
};

/** What {@link createVersionActions} works with; injectable for tests. */
export type VersionActionsDeps = {
  readonly versions: VersionsApi;
  /** The preview server, which shows a version's site in the browser apart from the live one. */
  readonly preview: Pick<PreviewApi, "openVersion">;
  /** Which opening of the site this window was loaded for (R6). */
  readonly sessionId: () => string;
  readonly session: Pick<EditorSession, "flush" | "edit" | "history" | "ui" | "library">;
  readonly list: VersionList;
  readonly notify: VersionNotices;
  /** Starts the window over with the site a version opened as (as New Site does). */
  readonly restart: () => void;
  /** Asks Publish to republish a version: its destinations open, to choose where (4.6b). */
  readonly republish: (version: VersionToRepublish) => void;
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

/** A name that fits a version's: `name`, cut to the longest a version may have. */
const fitted = (name: string) => fit(name, VERSION_NAME_MAX).trim();

/**
 * Version History's actions on the open site (F-SITE-4, 4.6), through main's `versions` calls on
 * the opening this window was loaded for. Each ends the canvas's edit in progress first, so a
 * version holds what the person sees; main saves the last changes before it saves a version.
 */
export function createVersionActions(deps: VersionActionsDeps): VersionActions {
  const { versions, preview, sessionId, session, list, notify, restart, republish } = deps;
  // The version before this opening's first unasked theme change, once asked for: a later change
  // waits for it, so the version never holds a change made while it saved.
  let themeVersion: Promise<boolean> | undefined;

  /** Saves a version for `reason`; the failure's message if it wasn't saved. */
  const saveFor = async (
    name: string,
    reason: "manual" | "before-restore" | "before-site-wide",
  ): Promise<string | undefined> => {
    session.flush();
    try {
      const result = await versions.save(sessionId(), { name: fitted(name), reason });
      if (result.status === "saved") {
        void list.refresh();
        return undefined;
      }
      // A version from moments ago holds the site from before this burst of changes.
      if (result.status === "skipped") return undefined;
      return result.reason === "read-only"
        ? t("versionHistory.readOnly")
        : t("versionHistory.saveFailed");
    } catch (error) {
      reportFailure("versions.save", error);
      return t("versionHistory.saveFailed");
    }
  };

  /**
   * Version `version`'s site, its rich text as this Webforge stores it, never a version's own
   * markup (S23); none, said why, when it can't be read.
   */
  const siteOf = async (version: VersionSummary): Promise<SiteDoc | undefined> => {
    let read: Awaited<ReturnType<VersionsApi["readSite"]>>;
    try {
      read = await versions.readSite(sessionId(), version.id);
    } catch (error) {
      reportFailure("versions.readSite", error);
      notify.error(t("versionHistory.unreadable.invalid"));
      return undefined;
    }
    if (read.status === "ok") return siteWithCleanRichText(read.site, session.library);
    notify.error(
      read.status === "not-found"
        ? t("versionHistory.unreadable.gone")
        : read.status === "unreadable" && read.reason === "newer-format"
          ? t("versionHistory.unreadable.newer")
          : t("versionHistory.unreadable.invalid"),
    );
    return undefined;
  };

  /** Where the editor goes after a restore: the page shown, or the home page if it's gone. */
  const selectionIn = (site: SiteDoc): EditorSelection => {
    const { pageId, viewport } = session.ui.getState();
    const shown = Object.hasOwn(site.pages, pageId) ? pageId : site.homePageId;
    return { pageId: shown, nodeId: null, viewport };
  };

  return {
    async save(name) {
      const failure = await saveFor(name, "manual");
      if (failure !== undefined) {
        notify.error(failure);
        return false;
      }
      notify.success(t("versionHistory.saved", { name: fitted(name) }));
      return true;
    },

    async preview(version) {
      const site = await siteOf(version);
      if (site === undefined) return false;
      const page = previewPageOf(site, session.ui.getState().pageId);
      try {
        if (
          (await preview.openVersion(sessionId(), siteContentFor(site, session.library), page)) ===
          "opened"
        ) {
          return true;
        }
      } catch (error) {
        reportFailure("versions.preview", error);
      }
      notify.error(t("versionHistory.previewFailed"));
      return false;
    },

    async restore(version) {
      const name = versionName(version);
      session.flush();
      const read = await siteOf(version);
      if (read === undefined) return false;
      // The site as it is now, so the restore can be gone back on even past Undo History.
      if ((await saveFor("", "before-restore")) !== undefined) {
        notify.error(t("versionHistory.restore.notSaved"));
        return false;
      }
      const restored = read;
      session.edit(
        "root",
        t("versionHistory.history.restored", { name }),
        (draft) => restoreSite(draft, restored),
        { selectionAfter: selectionIn(restored), apply: true },
      );
      notify.success(t("versionHistory.restored", { name }));
      return true;
    },

    republish(version) {
      republish({ id: version.id, name: versionName(version) });
    },

    async remove(version) {
      const name = versionName(version);
      try {
        const result = await versions.delete(sessionId(), version.id);
        void list.refresh();
        if (result.status === "failed") {
          notify.error(t("versionHistory.deleteFailed"));
          return false;
        }
        // One already gone is as the person wanted.
        notify.success(t("versionHistory.deleted", { name }));
        return true;
      } catch (error) {
        reportFailure("versions.delete", error);
        notify.error(t("versionHistory.deleteFailed"));
        return false;
      }
    },

    async openAsNewSite(version) {
      session.flush();
      const site = session.history.document.getState().settings.general.name;
      const name = newSiteName(site, versionName(version));
      let result: ProjectResult;
      try {
        result = await versions.openAsNewSite(sessionId(), version.id, name);
      } catch (error) {
        reportFailure("versions.openAsNewSite", error);
        notify.error(t("site.openFailed.unknown"));
        return;
      }
      if (result.status === "opened") {
        restart();
      } else if (result.status === "failed") {
        notify.error(
          result.reason === "not-found"
            ? t("versionHistory.openFailed.gone")
            : openFailureMessage(result.reason),
        );
      }
    },

    async cleanUp() {
      session.flush();
      const done = notify.working(t("versionHistory.cleaningUp"));
      try {
        const result = await versions.cleanUp(sessionId());
        if (result.status === "failed") {
          notify.error(
            result.reason === "read-only"
              ? t("versionHistory.readOnly")
              : t("versionHistory.cleanUpFailed"),
          );
          return false;
        }
        notify.success(
          result.freedBytes > 0
            ? t("versionHistory.cleanedUp", { size: fileSizeLabel(result.freedBytes) })
            : t("versionHistory.nothingToCleanUp"),
        );
        return true;
      } catch (error) {
        reportFailure("versions.cleanUp", error);
        notify.error(t("versionHistory.cleanUpFailed"));
        return false;
      } finally {
        done();
        void list.refresh();
      }
    },

    async beforeSiteWide(action, { asked }) {
      // The change goes ahead either way: it's one undo step, and the daily version holds the day.
      if (asked) {
        await saveFor(
          action.version ?? t("versionHistory.beforeAction", { action: action.confirm }),
          "before-site-wide",
        );
        return;
      }
      if (themeVersion === undefined || !(await themeVersion)) {
        const saving = saveFor(t("versionHistory.beforeThemeChanges"), "before-site-wide").then(
          (failure) => failure === undefined,
        );
        themeVersion = saving;
        // One that wasn't saved is tried again at the next change.
        if (!(await saving)) themeVersion = undefined;
      }
    },
  };
}
