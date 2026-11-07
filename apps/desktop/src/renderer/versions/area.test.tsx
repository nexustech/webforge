// @vitest-environment happy-dom
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { t } from "@webforge/i18n";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { VersionSummary } from "../../shared/ipc/versions.js";
import type { WindowContext } from "../editor/areas.js";
import { createSettingsRegistry } from "../editor/settings-registry.js";
import { COMMAND_IDS } from "../shell/command-ids.js";
import { createSiteWideConfirm } from "../shell/confirm-site-wide.js";
import { createWindowDialogs, WindowDialogs } from "../shell/window-dialogs.js";
import { registriesForTest, sessionWith } from "../testing/fixtures.js";
import { fakePreloadApi } from "../testing/preload.js";
import { versionHistoryArea } from "./area.js";

afterEach(cleanup);

const saved: VersionSummary = {
  id: "7a2b3c4d-5e6f-4a1b-8c2d-3e4f5a6b7c8d",
  name: "Before the new menu",
  reason: "manual",
  createdAt: "2026-11-06T10:05:00.000Z",
  bytes: 1024,
};

function setUp() {
  const registries = registriesForTest();
  const windowDialogs = createWindowDialogs();
  const settings = createSettingsRegistry();
  const siteWide = createSiteWideConfirm();
  const session = sessionWith();
  const api = fakePreloadApi({
    preview: { openVersion: vi.fn() } as never,
    versions: {
      list: vi.fn(async () => ({ status: "ok" as const, versions: [], bytes: 0 })),
      save: vi.fn(async () => ({ status: "saved" as const, version: saved })),
      delete: vi.fn(),
      readSite: vi.fn(),
      openAsNewSite: vi.fn(),
      cleanUp: vi.fn(),
    },
  });
  // Only what the area uses of the window's context.
  const context = {
    ...registries,
    api,
    session,
    windowDialogs,
    settings,
    siteWide,
  } as unknown as WindowContext;
  const remove = versionHistoryArea.register(context);
  render(<WindowDialogs registry={windowDialogs} />);
  return { registries, settings, siteWide, api, remove };
}

describe("versionHistoryArea (4.6)", () => {
  it("registers File → Save Version…, which asks for the version's name and saves it", async () => {
    const { registries, api } = setUp();
    expect(registries.commands.get(COMMAND_IDS.saveVersion)).toMatchObject({
      label: t("versionHistory.save"),
      menu: "file",
    });

    act(() => {
      registries.commands.run(COMMAND_IDS.saveVersion);
    });
    const user = userEvent.setup({ delay: null });
    await user.type(
      await screen.findByLabelText(t("versionHistory.saveDialog.name")),
      "Before the new menu",
    );
    await user.click(screen.getByRole("button", { name: t("versionHistory.saveDialog.confirm") }));

    await vi.waitFor(() =>
      expect(api.versions.save).toHaveBeenCalledWith(expect.any(String), {
        name: "Before the new menu",
        reason: "manual",
      }),
    );
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("adds the panel beside Undo History, and saves a version before a confirmed change to every page", async () => {
    const { registries, siteWide, api } = setUp();
    expect(registries.panels.list()).toEqual([
      expect.objectContaining({ id: "versionHistory", slot: "left.bottom" }),
    ]);

    const answer = siteWide.confirmSiteWide({
      action: "Delete page 'About'?",
      confirm: "Delete Page",
      affectedPages: 3,
    });
    siteWide.answer(true);

    await expect(answer).resolves.toBe(true);
    expect(api.versions.save).toHaveBeenCalledWith(expect.any(String), {
      name: t("versionHistory.beforeAction", { action: "Delete Page" }),
      reason: "before-site-wide",
    });
  });

  it("adds Versions kept to the app's Settings, saved as the person's preference", () => {
    const { settings, registries } = setUp();
    const part = settings.list().find((entry) => entry.id === "versions");
    expect(part).toMatchObject({ heading: "app" });

    const opened = part?.open();
    if (opened === undefined) throw new Error("no Version History part");
    opened.save({ versionsKept: 50 });

    expect(registries.preferences.getState().preferences.versionsKept).toBe(50);
  });

  it("removes all it added, and the hook too", async () => {
    const { registries, settings, siteWide, api, remove } = setUp();
    remove();

    expect(registries.commands.get(COMMAND_IDS.saveVersion)).toBeUndefined();
    expect(registries.panels.list()).toEqual([]);
    expect(settings.list()).toEqual([]);
    const answer = siteWide.confirmSiteWide({
      action: "Delete page 'About'?",
      confirm: "Delete Page",
      affectedPages: 3,
    });
    siteWide.answer(true);
    await answer;
    expect(api.versions.save).not.toHaveBeenCalled();
  });
});
