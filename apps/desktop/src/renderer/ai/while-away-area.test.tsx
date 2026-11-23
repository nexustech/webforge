// @vitest-environment happy-dom
import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { insertPage, newId, type SiteDoc } from "@webforge/model";
import type { ComponentType } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AiRequest, AiResponse } from "../../shared/ipc/ai.js";
import type { VersionSummary } from "../../shared/ipc/versions.js";
import { starterSite } from "../../shared/starter-site.js";
import { sessionWith } from "../testing/fixtures.js";
import { createVersionActions } from "../versions/index.js";
import { registerWhileAway } from "./while-away-area.js";

afterEach(cleanup);

const BEFORE: VersionSummary = {
  id: "0b6c8f8e-9a1d-4c2e-8f3a-5d7b9c1e2f40",
  name: "Before Claude's changes",
  reason: "before-site-wide",
  createdAt: "2026-11-23T10:00:00.000Z",
  bytes: 1024,
};

/** A change Claude made: its request, unasked or not, and the answer it got. */
const unasked = (asked = true, app = "Claude"): AiRequest => ({
  kind: "command",
  name: "updateFields",
  input: {},
  app,
  ...(asked ? { unasked: true } : {}),
});
const done = (label: string, pageId?: string): AiResponse => ({
  status: "done",
  label: `AI (Claude): ${label}`,
  ...(pageId === undefined ? {} : { target: { pageId } }),
});

/**
 * *While you were away* on a site whose version before Claude's changes is `version`, with Version
 * History's own restore; the person away until `come back` is called.
 */
function setUp(listed: readonly VersionSummary[] = [BEFORE], listing: "ok" | "failed" = "ok") {
  const session = sessionWith(starterSite());
  // The site before Claude's changes, as main saved it.
  const version: SiteDoc = structuredClone(session.history.document.getState());
  const versions = {
    list: vi.fn(async () =>
      listing === "ok"
        ? { status: "ok" as const, versions: [...listed], bytes: 0 }
        : { status: "failed" as const, reason: "unknown" as const },
    ),
    save: vi.fn(async () => ({
      status: "saved" as const,
      version: { ...BEFORE, id: crypto.randomUUID() },
    })),
    delete: vi.fn(),
    readSite: vi.fn(async () => ({ status: "ok" as const, site: structuredClone(version) })),
    openAsNewSite: vi.fn(),
    cleanUp: vi.fn(),
  };
  const actions = createVersionActions({
    versions: versions as never,
    preview: { openVersion: vi.fn() },
    sessionId: () => "5d1c6e2a-3b4f-4c5d-8e9f-0a1b2c3d4e5f",
    session,
    list: { state: undefined as never, refresh: vi.fn(async () => undefined) },
    notify: { success: vi.fn(), error: vi.fn(), working: vi.fn(() => vi.fn()) },
    restart: vi.fn(),
    republish: vi.fn(),
  });
  let Dialog: ComponentType = () => null;
  let back: () => void = () => undefined;
  const present = { value: false };
  const notify = vi.fn();
  const whileAway = registerWhileAway({
    windowDialogs: {
      register: (dialog) => {
        Dialog = dialog.component;
        return () => undefined;
      },
    },
    session,
    listVersions: versions.list,
    restore: actions.restore,
    notify,
    present: () => present.value,
    onReturn: (listener) => {
      back = listener;
      return () => undefined;
    },
    now: () => Date.parse("2026-11-23T11:00:00.000Z"),
  });
  render(<Dialog />);
  return {
    session,
    version,
    whileAway,
    present,
    notify,
    comeBack: () => act(() => back()),
    user: userEvent.setup({ delay: null }),
  };
}

describe("While you were away (5.36, UA-3)", () => {
  it("shows what an app changed unasked while the person was away, by page, when they come back", async () => {
    const { session, whileAway, comeBack, user } = setUp();
    const home = session.history.document.getState().homePageId;
    whileAway.heard(unasked(), done("Edited Hero text", home));
    whileAway.heard(unasked(), done("Changed the theme"));
    expect(screen.queryByRole("dialog")).toBeNull();

    comeBack();
    const dialog = within(screen.getByRole("dialog", { name: "While You Were Away" }));
    const claude = within(dialog.getByRole("region", { name: "What Claude changed" }));
    expect(claude.getByText("Edited Hero text")).toBeTruthy();
    expect(claude.getByText("Every page")).toBeTruthy();
    expect(claude.getByText("Changed the theme")).toBeTruthy();

    // Each page leads to it, by keyboard.
    const title = session.history.document.getState().pages[home]?.title ?? "";
    const show = claude.getByRole("button", { name: `Show ${title}` });
    show.focus();
    await user.keyboard("{Enter}");
    expect(session.ui.getState().pageId).toBe(home);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("puts the site back as the version before the app's first change, with Undo All", async () => {
    const { session, version, whileAway, comeBack, user } = setUp();
    // Claude's changes, made unasked: a page added, the site renamed.
    const added = newId("page");
    session.edit("insert", "AI (Claude): Added page 'Menu'", (draft) =>
      insertPage(draft, added, "Menu"),
    );
    whileAway.heard(unasked(), done("Added page 'Menu'", added));
    session.edit("props", "AI (Claude): Changed Site Settings", (draft) => {
      draft.settings.general.name = "Rosa's Café";
    });
    whileAway.heard(unasked(), done("Changed Site Settings"));

    comeBack();
    await user.click(screen.getByRole("button", { name: "Undo All of Claude's Changes" }));

    await vi.waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    const site = session.history.document.getState();
    expect(site.pages).toEqual(version.pages);
    expect(site.pageOrder).toEqual(version.pageOrder);
    expect(site.settings).toEqual(version.settings);
    expect(site.theme).toEqual(version.theme);
    // One undo step, which Undo takes back.
    expect(session.history.entries().at(-1)?.label).toMatch(/Restored version/);
  });

  it("lists none of the changes Undo All took back, another app's too (#1352's review)", async () => {
    const { whileAway, comeBack, user } = setUp();
    whileAway.heard(unasked(), done("Changed the theme"));
    whileAway.heard(unasked(true, "Cursor"), {
      status: "done",
      label: "AI (Cursor): Added Gallery",
    });
    comeBack();
    expect(screen.getByRole("button", { name: "Undo All of Cursor's Changes" })).toBeTruthy();

    // Claude's version is from before both: restoring it took back Cursor's change as well.
    await user.click(screen.getByRole("button", { name: "Undo All of Claude's Changes" }));

    await vi.waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.queryByRole("button", { name: "Undo All of Cursor's Changes" })).toBeNull();
  });

  it("says so when the versions can't be listed, and changes nothing", async () => {
    const { session, whileAway, comeBack, notify, user } = setUp(undefined, "failed");
    whileAway.heard(unasked(), done("Changed the theme"));
    const steps = session.history.entries().length;
    comeBack();
    await user.click(screen.getByRole("button", { name: "Undo All of Claude's Changes" }));

    await vi.waitFor(() =>
      expect(notify).toHaveBeenCalledWith(
        "Webforge couldn't put the site back. Try again, or use Version History.",
      ),
    );
    expect(session.history.entries()).toHaveLength(steps);
  });

  it("shows nothing for changes made asked, made with the person there, or that changed nothing", () => {
    const { session, whileAway, present, comeBack } = setUp();
    const home = session.history.document.getState().homePageId;
    whileAway.heard(unasked(false), done("Edited Hero text", home));
    whileAway.heard(unasked(), { status: "declined", message: "No." });
    present.value = true;
    whileAway.heard(unasked(), done("Changed the theme"));

    comeBack();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("says so when no version from before the app's changes is there, and changes nothing", async () => {
    // One saved after the change only: none from before it.
    const { session, whileAway, comeBack, notify, user } = setUp([
      { ...BEFORE, name: "", createdAt: "2026-11-23T12:00:00.000Z" },
    ]);
    whileAway.heard(unasked(), done("Changed the theme"));
    const steps = session.history.entries().length;
    comeBack();
    await user.click(screen.getByRole("button", { name: "Undo All of Claude's Changes" }));

    await vi.waitFor(() =>
      expect(notify).toHaveBeenCalledWith(
        "No version from before Claude's changes was found. Open Version History.",
      ),
    );
    expect(session.history.entries()).toHaveLength(steps);
    expect(screen.getByRole("dialog", { name: "While You Were Away" })).toBeTruthy();
  });
});
