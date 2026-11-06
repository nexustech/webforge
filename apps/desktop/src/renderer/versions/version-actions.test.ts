import { t } from "@webforge/i18n";
import { type NodeDoc, newId, type SiteDoc } from "@webforge/model";
import { describe, expect, it, vi } from "vitest";
import type { ProjectResult } from "../../shared/ipc/project.js";
import type { VersionSummary, VersionsApi } from "../../shared/ipc/versions.js";
import { starterSite } from "../../shared/starter-site.js";
import { sessionWith } from "../testing/fixtures.js";
import { createVersionActions } from "./version-actions.js";

const SESSION_ID = "5d1c6e2a-3b4f-4c5d-8e9f-0a1b2c3d4e5f";
const HOSTILE = '<p>Hi<script>alert(1)</script><img src="x" onerror="alert(1)"></p>';

const summary = (fields: Partial<VersionSummary> = {}): VersionSummary => ({
  id: "0b6c8f8e-9a1d-4c2e-8f3a-5d7b9c1e2f40",
  name: "Before the menu",
  reason: "manual",
  createdAt: "2026-11-06T10:05:00.000Z",
  bytes: 1024,
  ...fields,
});

/** Main's `versions` calls, each answering as it would for a site that saves. */
function fakeVersions(overrides: Partial<VersionsApi> = {}) {
  return {
    list: vi.fn(async () => ({ status: "ok" as const, versions: [], bytes: 0 })),
    save: vi.fn(async () => ({ status: "saved" as const, version: summary() })),
    delete: vi.fn(async () => ({ status: "deleted" as const })),
    readSite: vi.fn<VersionsApi["readSite"]>(async () => ({ status: "not-found" })),
    openAsNewSite: vi.fn<VersionsApi["openAsNewSite"]>(async () => ({ status: "canceled" })),
    ...overrides,
  } satisfies VersionsApi;
}

function setUp(versions = fakeVersions(), site: SiteDoc = starterSite()) {
  const session = sessionWith(site);
  const flush = vi.spyOn(session, "flush");
  const list = { state: undefined as never, refresh: vi.fn(async () => undefined) };
  const notify = { success: vi.fn(), error: vi.fn() };
  const restart = vi.fn();
  const actions = createVersionActions({
    versions,
    sessionId: () => SESSION_ID,
    session,
    list,
    notify,
    restart,
  });
  const doc = () => session.history.document.getState();
  return { actions, versions, session, flush, list, notify, restart, doc };
}

/**
 * The open site, the starter site with an About page, and a version of it from before About was
 * added: its home page named otherwise, with rich text.
 */
function siteAndVersion() {
  const version = starterSite();
  const home = version.pages[version.homePageId];
  if (home === undefined) throw new Error("no home page");
  home.title = "As it was";
  const text: NodeDoc = { type: "Text", props: { id: "t1", text: HOSTILE } };
  home.doc.content = [text];
  const site = starterSite();
  const about = newId("page");
  const starterHome = site.pages[site.homePageId];
  if (starterHome === undefined) throw new Error("no home page");
  site.pages[about] = { ...structuredClone(starterHome), id: about, slug: "about", title: "About" };
  site.pageOrder = [...site.pageOrder, about];
  return { site, version, about };
}

describe("Version History's actions (4.6)", () => {
  it("saves the person's version by its name, once the canvas's edit has ended", async () => {
    const { actions, versions, flush, list, notify } = setUp();

    expect(await actions.save("Before the menu")).toBe(true);

    expect(flush).toHaveBeenCalledOnce();
    expect(versions.save).toHaveBeenCalledWith(SESSION_ID, {
      name: "Before the menu",
      reason: "manual",
    });
    expect(list.refresh).toHaveBeenCalledOnce();
    expect(notify.success).toHaveBeenCalledWith(
      t("versionHistory.saved", { name: "Before the menu" }),
    );
  });

  it("says why a version wasn't saved", async () => {
    const readOnly = setUp(
      fakeVersions({ save: async () => ({ status: "failed", reason: "read-only" }) }),
    );
    expect(await readOnly.actions.save("Mine")).toBe(false);
    expect(readOnly.notify.error).toHaveBeenCalledWith(t("versionHistory.readOnly"));

    const thrown = setUp(
      fakeVersions({
        save: async () => {
          throw new Error("gone");
        },
      }),
    );
    expect(await thrown.actions.save("Mine")).toBe(false);
    expect(thrown.notify.error).toHaveBeenCalledWith(t("versionHistory.saveFailed"));
  });

  it("restores a version as one undo step, after a version of the site as it is now (F-SITE-4)", async () => {
    const { site, version, about: gone } = siteAndVersion();
    const order: string[] = [];
    const { actions, session, notify, doc } = setUp(
      fakeVersions({
        readSite: async () => {
          order.push("read");
          return { status: "ok", site: version };
        },
        save: async (_id, request) => {
          // The version before the restore holds the site as it was.
          order.push(`${request.reason}: ${String(doc().pages[gone] !== undefined)}`);
          return { status: "saved", version: summary({ reason: request.reason }) };
        },
      }),
      site,
    );
    session.showPage(gone);
    const before = doc();

    expect(await actions.restore(summary())).toBe(true);

    expect(order).toEqual(["read", "before-restore: true"]);
    const home = doc().pages[doc().homePageId];
    expect(home?.title).toBe("As it was");
    // Its rich text as this Webforge stores it (S23).
    expect(home?.doc.content).toEqual([{ type: "Text", props: { id: "t1", text: "<p>Hi</p>" } }]);
    expect(doc().pages[gone]).toBeUndefined();
    // The page shown is gone, so the home page is shown.
    expect(session.ui.getState().pageId).toBe(doc().homePageId);
    expect(session.history.entries().map((entry) => entry.label)).toEqual([
      t("versionHistory.history.restored", { name: "Before the menu" }),
    ]);
    expect(notify.success).toHaveBeenCalledWith(
      t("versionHistory.restored", { name: "Before the menu" }),
    );

    session.history.undo();
    expect(doc()).toEqual(before);
  });

  it.each([
    [{ status: "not-found" } as const, t("versionHistory.restore.gone")],
    [{ status: "unreadable", reason: "newer-format" } as const, t("versionHistory.restore.newer")],
    [{ status: "unreadable", reason: "invalid" } as const, t("versionHistory.restore.invalid")],
    [{ status: "failed", reason: "unknown" } as const, t("versionHistory.restore.invalid")],
  ])("restores nothing from a version that doesn't read (%o)", async (read, message) => {
    const { actions, versions, session, notify } = setUp(
      fakeVersions({ readSite: async () => read }),
    );

    expect(await actions.restore(summary())).toBe(false);

    expect(notify.error).toHaveBeenCalledWith(message);
    expect(versions.save).not.toHaveBeenCalled();
    expect(session.history.entries()).toEqual([]);
  });

  it("restores nothing when the site as it is now can't be saved first", async () => {
    const { site, version } = siteAndVersion();
    const { actions, session, notify } = setUp(
      fakeVersions({
        readSite: async () => ({ status: "ok", site: version }),
        save: async () => ({ status: "failed", reason: "unknown" }),
      }),
      site,
    );

    expect(await actions.restore(summary())).toBe(false);

    expect(notify.error).toHaveBeenCalledWith(t("versionHistory.restore.notSaved"));
    expect(session.history.entries()).toEqual([]);
  });

  it("deletes a version, and says so", async () => {
    const { actions, versions, list, notify } = setUp();
    const version = summary({ name: "", reason: "daily" });

    expect(await actions.remove(version)).toBe(true);

    expect(versions.delete).toHaveBeenCalledWith(SESSION_ID, version.id);
    expect(list.refresh).toHaveBeenCalledOnce();
    expect(notify.success).toHaveBeenCalledWith(
      t("versionHistory.deleted", { name: t("versionHistory.reason.daily") }),
    );

    const failed = setUp(
      fakeVersions({ delete: async () => ({ status: "failed", reason: "unknown" }) }),
    );
    expect(await failed.actions.remove(version)).toBe(false);
    expect(failed.notify.error).toHaveBeenCalledWith(t("versionHistory.deleteFailed"));
  });

  it("opens a version as a new site named after both, and starts the window over with it (P5)", async () => {
    const opened: ProjectResult = {
      status: "opened",
      project: {
        sessionId: SESSION_ID,
        name: "Bakery (Before the menu)",
        fileName: "Bakery (Before the menu).wforge",
        formatVersion: 2,
        syncService: null,
      },
    };
    const { actions, versions, restart, doc } = setUp(
      fakeVersions({ openAsNewSite: vi.fn(async () => opened) }),
    );

    await actions.openAsNewSite(summary());

    const site = doc().settings.general.name;
    expect(versions.openAsNewSite).toHaveBeenCalledWith(
      SESSION_ID,
      summary().id,
      t("versionHistory.newSiteName", { site, version: "Before the menu" }),
    );
    expect(restart).toHaveBeenCalledOnce();
  });

  it("opens nothing when the person cancels, and says why when it fails", async () => {
    const canceled = setUp();
    await canceled.actions.openAsNewSite(summary());
    expect(canceled.restart).not.toHaveBeenCalled();
    expect(canceled.notify.error).not.toHaveBeenCalled();

    const gone = setUp(
      fakeVersions({ openAsNewSite: async () => ({ status: "failed", reason: "not-found" }) }),
    );
    await gone.actions.openAsNewSite(summary());
    expect(gone.restart).not.toHaveBeenCalled();
    expect(gone.notify.error).toHaveBeenCalledWith(t("versionHistory.openFailed.gone"));
  });

  it("saves a version before each confirmed change to every page, and one before the first unasked theme change (A21)", async () => {
    const save = vi.fn<VersionsApi["save"]>(async () => ({ status: "saved", version: summary() }));
    const { actions } = setUp(fakeVersions({ save }));
    const deletePage = { action: "Delete page 'About'?", confirm: "Delete Page", affectedPages: 6 };
    const cardStyle = {
      action: "Changed card style",
      confirm: "Changed card style",
      affectedPages: 6,
    };

    await actions.beforeSiteWide(deletePage, { asked: true });
    await actions.beforeSiteWide(deletePage, { asked: true });
    await actions.beforeSiteWide(cardStyle, { asked: false });
    await actions.beforeSiteWide(cardStyle, { asked: false });

    expect(save.mock.calls.map(([, request]) => request)).toEqual([
      {
        name: t("versionHistory.beforeAction", { action: "Delete Page" }),
        reason: "before-site-wide",
      },
      {
        name: t("versionHistory.beforeAction", { action: "Delete Page" }),
        reason: "before-site-wide",
      },
      { name: t("versionHistory.beforeThemeChanges"), reason: "before-site-wide" },
    ]);
  });

  it("takes a version main skips, one from moments ago holding the site, as saved", async () => {
    const { actions, list, notify } = setUp(
      fakeVersions({ save: async () => ({ status: "skipped" }) }),
    );
    const deletePage = { action: "Delete page 'About'?", confirm: "Delete Page", affectedPages: 6 };

    await actions.beforeSiteWide(deletePage, { asked: true });

    expect(list.refresh).not.toHaveBeenCalled();
    expect(notify.error).not.toHaveBeenCalled();
  });

  it("tries the theme changes' version again when it couldn't be saved", async () => {
    const save = vi
      .fn<VersionsApi["save"]>()
      .mockResolvedValueOnce({ status: "failed", reason: "unknown" })
      .mockResolvedValue({ status: "saved", version: summary() });
    const { actions } = setUp(fakeVersions({ save }));
    const cardStyle = {
      action: "Changed card style",
      confirm: "Changed card style",
      affectedPages: 6,
    };

    await actions.beforeSiteWide(cardStyle, { asked: false });
    await actions.beforeSiteWide(cardStyle, { asked: false });
    await actions.beforeSiteWide(cardStyle, { asked: false });

    expect(save).toHaveBeenCalledTimes(2);
  });
});
