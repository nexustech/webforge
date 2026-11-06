import { t } from "@webforge/i18n";
import { restoreSite, type SiteDoc } from "@webforge/model";
import { siteWithCleanRichText } from "@webforge/site-components";
import type { ProjectResult } from "../../shared/ipc/project.js";
import {
  VERSION_NAME_MAX,
  type VersionSummary,
  type VersionsApi,
} from "../../shared/ipc/versions.js";
import { openFailureMessage } from "../../shared/open-failure.js";
import type { EditorSession } from "../editor/editor-session.js";
import type { EditorSelection } from "../editor/selection.js";
import { reportFailure } from "../log.js";
import type { SiteWideAction } from "../shell/confirm-site-wide.js";
import type { VersionList } from "./version-list.js";
import { fit, newSiteName, versionName } from "./version-words.js";

/** What the person is told: a toast in the app. */
type VersionNotices = {
  readonly success: (message: string) => void;
  readonly error: (message: string) => void;
};

/** What {@link createVersionActions} works with; injectable for tests. */
export type VersionActionsDeps = {
  readonly versions: VersionsApi;
  /** Which opening of the site this window was loaded for (R6). */
  readonly sessionId: () => string;
  readonly session: Pick<EditorSession, "flush" | "edit" | "history" | "ui" | "library">;
  readonly list: VersionList;
  readonly notify: VersionNotices;
  /** Starts the window over with the site a version opened as (as New Site does). */
  readonly restart: () => void;
};

/** What the Version History panel and its commands do. */
export type VersionActions = {
  /** Saves the person's own version, named `name` (Save Version…); true once saved. */
  save(name: string): Promise<boolean>;
  /**
   * Restores `version` as one undo step, "Restored version '…'", once a version of the site as it
   * is now is saved; true once restored.
   */
  restore(version: VersionSummary): Promise<boolean>;
  /** Deletes `version`; true once deleted. */
  remove(version: VersionSummary): Promise<boolean>;
  /** Opens `version` as a new site where the person chooses (P5), which replaces this one. */
  openAsNewSite(version: VersionSummary): Promise<void>;
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
  const { versions, sessionId, session, list, notify, restart } = deps;
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

    async restore(version) {
      const name = versionName(version);
      session.flush();
      let read: Awaited<ReturnType<VersionsApi["readSite"]>>;
      try {
        read = await versions.readSite(sessionId(), version.id);
      } catch (error) {
        reportFailure("versions.readSite", error);
        notify.error(t("versionHistory.restore.invalid"));
        return false;
      }
      if (read.status !== "ok") {
        notify.error(
          read.status === "not-found"
            ? t("versionHistory.restore.gone")
            : read.status === "unreadable" && read.reason === "newer-format"
              ? t("versionHistory.restore.newer")
              : t("versionHistory.restore.invalid"),
        );
        return false;
      }
      // The site as it is now, so the restore can be gone back on even past Undo History.
      if ((await saveFor("", "before-restore")) !== undefined) {
        notify.error(t("versionHistory.restore.notSaved"));
        return false;
      }
      // Rich text as this Webforge stores it, never a version's own markup (S23).
      const restored = siteWithCleanRichText(read.site, session.library);
      session.edit(
        "root",
        t("versionHistory.history.restored", { name }),
        (draft) => restoreSite(draft, restored),
        { selectionAfter: selectionIn(restored), apply: true },
      );
      notify.success(t("versionHistory.restored", { name }));
      return true;
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

    async beforeSiteWide(action, { asked }) {
      // The change goes ahead either way: it's one undo step, and the daily version holds the day.
      if (asked) {
        await saveFor(
          t("versionHistory.beforeAction", { action: action.confirm }),
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
