// @vitest-environment happy-dom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { t } from "@webforge/i18n";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { VersionSummary } from "../../shared/ipc/versions.js";
import { registriesForTest } from "../testing/fixtures.js";
import { registerVersionHistoryPanel } from "./register-version-history-panel.js";
import { VersionHistoryPanel, type VersionHistoryPanelProps } from "./VersionHistoryPanel.js";
import { createVersionList } from "./version-list.js";

afterEach(cleanup);

const mine: VersionSummary = {
  id: "7a2b3c4d-5e6f-4a1b-8c2d-3e4f5a6b7c8d",
  name: "Before the new menu",
  reason: "manual",
  createdAt: "2026-11-06T10:05:00.000Z",
  thumbnailHash: "a".repeat(64),
  bytes: 524_288,
};
const daily: VersionSummary = {
  id: "9e8d7c6b-5a4f-4e3d-9c2b-1a0f9e8d7c6b",
  name: "",
  reason: "daily",
  createdAt: "2026-11-06T08:30:00.000Z",
  bytes: 2048,
};

function draw(props: Partial<VersionHistoryPanelProps> = {}) {
  const actions = {
    restore: vi.fn(async () => true),
    remove: vi.fn(async () => true),
    openAsNewSite: vi.fn(async () => undefined),
  };
  const onSave = vi.fn();
  render(
    <VersionHistoryPanel
      state={{ status: "ready", versions: [mine, daily], bytes: 2_516_582 }}
      actions={actions}
      onSave={onSave}
      locale="en-GB"
      {...props}
    />,
  );
  return { actions, onSave };
}

/** Opens version `name`'s menu and chooses `item`. */
async function choose(name: string, item: string) {
  await userEvent.click(
    screen.getByRole("button", { name: t("versionHistory.actions", { name }) }),
  );
  await userEvent.click(await screen.findByRole("menuitem", { name: item }));
}

describe("the Version History panel (4.6)", () => {
  it("lists the versions newest first, with their pictures, names, times and the space they use", () => {
    draw();

    const items = within(screen.getByRole("list", { name: t("versionHistory.list") })).getAllByRole(
      "listitem",
    );
    expect(items.map((item) => item.textContent)).toEqual([
      expect.stringContaining("Before the new menu"),
      expect.stringContaining(t("versionHistory.reason.daily")),
    ]);
    // Webforge's own versions say so; the person's don't.
    expect(items[0]?.textContent).not.toContain(t("versionHistory.automatic"));
    expect(items[1]?.textContent).toContain(t("versionHistory.automatic"));
    expect(items[0]?.textContent).toContain("6 Nov 2026");
    expect(items[0]?.querySelector("img")?.getAttribute("src")).toBe(
      `webforge-media://original/${"a".repeat(64)}`,
    );
    expect(items[1]?.querySelector("img")).toBeNull();
    expect(screen.getByText(t("versionHistory.space", { size: "2.4 MB" }))).toBeTruthy();
  });

  it("asks before restoring a version, and restores it once the person agrees", async () => {
    const { actions } = draw();

    await choose("Before the new menu", t("versionHistory.restore"));
    const question = await screen.findByRole("alertdialog", {
      name: t("versionHistory.restore.title", { name: "Before the new menu" }),
    });
    expect(actions.restore).not.toHaveBeenCalled();
    await userEvent.click(
      within(question).getByRole("button", { name: t("versionHistory.restore.confirm") }),
    );

    expect(actions.restore).toHaveBeenCalledWith(mine);
  });

  it("deletes a version only once the person agrees", async () => {
    const { actions } = draw();

    await choose(t("versionHistory.reason.daily"), t("versionHistory.delete"));
    await userEvent.click(await screen.findByRole("button", { name: t("versionHistory.cancel") }));
    expect(actions.remove).not.toHaveBeenCalled();

    await choose(t("versionHistory.reason.daily"), t("versionHistory.delete"));
    await userEvent.click(
      await screen.findByRole("button", { name: t("versionHistory.delete.confirm") }),
    );
    expect(actions.remove).toHaveBeenCalledWith(daily);
  });

  it("opens a version as a new site, and saves one", async () => {
    const { actions, onSave } = draw();

    await choose("Before the new menu", t("versionHistory.openAsNewSite"));
    expect(actions.openAsNewSite).toHaveBeenCalledWith(mine);

    await userEvent.click(screen.getByRole("button", { name: t("versionHistory.save") }));
    expect(onSave).toHaveBeenCalledOnce();
  });

  it("says when there are no versions yet, while they're found, and when they can't be", () => {
    draw({ state: { status: "ready", versions: [], bytes: 0 } });
    expect(screen.getByText(t("versionHistory.empty"))).toBeTruthy();
    cleanup();
    draw({ state: { status: "loading" } });
    expect(screen.getByRole("status").textContent).toBe(t("versionHistory.loading"));
    cleanup();
    draw({ state: { status: "failed" } });
    expect(screen.getByRole("status").textContent).toBe(t("versionHistory.loadFailed"));
  });

  it("is added beside Undo History, and lists the versions as it's shown", async () => {
    const { panels } = registriesForTest();
    const list = vi.fn(async () => ({ status: "ok" as const, versions: [mine], bytes: 100 }));
    const remove = registerVersionHistoryPanel(
      panels,
      createVersionList(list),
      { restore: vi.fn(), remove: vi.fn(), openAsNewSite: vi.fn() },
      vi.fn(),
    );

    const [panel] = panels.list();
    expect(panel).toMatchObject({
      id: "versionHistory",
      slot: "left.bottom",
      title: t("versionHistory.panelTitle"),
    });
    const Panel = panel?.component;
    if (Panel === undefined) throw new Error("no panel");
    render(<Panel />);
    expect(await screen.findByText("Before the new menu")).toBeTruthy();
    expect(list).toHaveBeenCalledOnce();
    remove();
    expect(panels.list()).toEqual([]);
  });
});
