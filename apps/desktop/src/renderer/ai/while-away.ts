import { t } from "@webforge/i18n";
import type { VersionSummary } from "../../shared/ipc/versions.js";

/**
 * "While you were away" (5.36, UA-3): what an AI app working without asking (5.35) changed while
 * the person was away from the window, shown when they come back, with **Undo All**, which goes
 * back to the version saved before the app's first change (_Before app's changes_).
 */

/** A change an app made unasked while the person was away: its undo step's label and its page. */
export type AwayChange = {
  /** The app, by the name the person gave it. */
  readonly app: string;
  /** Its undo step's label: "AI (Claude): Changed the theme". */
  readonly label: string;
  /** The page it changed; none for one that reaches every page. */
  readonly pageId?: string | undefined;
  /** When it was made, in ms. */
  readonly at: number;
};

/** One page's changes, or those that reach every page (`pageId` null). */
type AwayPage = {
  readonly pageId: string | null;
  readonly title: string;
  /** The changes, as Undo History names them, without the app's name before each. */
  readonly changes: readonly string[];
};

/** One app's changes while the person was away, by page, and when the first was made. */
export type AwayApp = {
  readonly app: string;
  readonly pages: readonly AwayPage[];
  readonly firstAt: number;
};

/** The "AI (‹app›): " every AI app's step label starts with, which the list needn't repeat. */
const LABEL_PREFIX = /^AI \([^)]*\): /;

/**
 * `changes` by app, then by page, each in the order first made. A page that's gone since, or a
 * change on no one page, is listed under _Every page_, with nothing to show.
 */
export function groupAway(
  changes: readonly AwayChange[],
  pageTitle: (pageId: string) => string | undefined,
): AwayApp[] {
  const apps = new Map<string, { firstAt: number; pages: Map<string | null, AwayPage> }>();
  for (const change of changes) {
    const app = apps.get(change.app) ?? { firstAt: change.at, pages: new Map() };
    apps.set(change.app, app);
    const title = change.pageId === undefined ? undefined : pageTitle(change.pageId);
    const pageId = title === undefined ? null : (change.pageId ?? null);
    const page = app.pages.get(pageId) ?? {
      pageId,
      title: title ?? t("ai.away.everyPage"),
      changes: [],
    };
    app.pages.set(pageId, {
      ...page,
      changes: [...page.changes, change.label.replace(LABEL_PREFIX, "")],
    });
  }
  return [...apps].map(([app, { firstAt, pages }]) => ({
    app,
    firstAt,
    pages: [...pages.values()],
  }));
}

/**
 * The version **Undo All** goes back to for `app` (5.36): the newest named _Before ‹app›'s
 * changes_, saved before its first change on this opening of the site (S20); or, when none was
 * saved because a version from moments before held the site already, the newest saved before
 * `firstAt`. `versions` are newest first.
 */
export function versionBefore(
  versions: readonly VersionSummary[],
  app: string,
  firstAt: number,
): VersionSummary | undefined {
  const name = t("ai.version.before", { app });
  return (
    versions.find((version) => version.name === name) ??
    versions.find((version) => Date.parse(version.createdAt) <= firstAt)
  );
}

/** The changes made while the person was away, kept until they come back. */
export type AwayLog = {
  /** Keeps `change`. */
  record(change: AwayChange): void;
  /** The changes kept, which are then forgotten: they're being shown. */
  take(): readonly AwayChange[];
};

/** An empty {@link AwayLog}. */
export function createAwayLog(): AwayLog {
  let kept: AwayChange[] = [];
  return {
    record(change) {
      kept.push(change);
    },
    take() {
      const taken = kept;
      kept = [];
      return taken;
    },
  };
}
