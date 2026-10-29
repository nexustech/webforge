// @vitest-environment happy-dom
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Toaster, TooltipProvider } from "@webforge/editor-ui";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ProjectResult, RecentSite } from "../../shared/ipc-contract.js";
import { CommandRegistryProvider } from "../shell/command-context.js";
import { COMMAND_IDS } from "../shell/command-ids.js";
import { type CommandRegistry, createCommandRegistry } from "../shell/commands.js";
import { TitleBar } from "../shell/TitleBar.js";
import { SiteCommands } from "./SiteCommands.js";

vi.mock("../log.js", () => ({ reportFailure: vi.fn() }));

afterEach(() => cleanup());

const project = {
  sessionId: "9b2f6c1e-4d3a-4f7b-8e21-5c6d7a8b9c0d",
  name: "Bakery",
  fileName: "Bakery.wforge",
  formatVersion: 1,
  syncService: null,
};

/** A recent site named `name`, opened `hour` o'clock on 21 Oct 2026. */
function site(name: string, hour: number, more: Partial<RecentSite> = {}): RecentSite {
  return {
    id: (hour % 16).toString(16).repeat(32),
    name,
    fileName: `${name}.wforge`,
    folder: "Sites",
    lastOpened: `2026-10-21T${String(hour).padStart(2, "0")}:00:00.000Z`,
    lastEdited: null,
    thumbnail: null,
    missing: false,
    pinned: false,
    ...more,
  };
}

function api(recent: RecentSite[], result: ProjectResult = { status: "opened", project }) {
  return {
    create: vi.fn(async () => result),
    open: vi.fn(async () => result),
    listRecent: vi.fn(async () => recent),
    openRecent: vi.fn(async (_id: string) => result),
    clearRecent: vi.fn(async () => null),
  };
}

/** The title bar's menus with the File menu's site commands, File › Open Recent among them. */
async function setUp(fake: ReturnType<typeof api>) {
  const registry = createCommandRegistry();
  const restart = vi.fn();
  render(
    <CommandRegistryProvider registry={registry}>
      <TooltipProvider>
        <TitleBar siteName="Bloom Bakery" />
        <SiteCommands project={fake} templates={{ list: async () => [] }} restart={restart} />
        <Toaster />
      </TooltipProvider>
    </CommandRegistryProvider>,
  );
  await waitFor(() => expect(fake.listRecent).toHaveBeenCalled());
  await act(async () => undefined);
  return { registry, restart };
}

/** Open Recent's submenu, as its commands. */
const submenu = (registry: CommandRegistry) =>
  registry.list().filter((command) => command.submenu === COMMAND_IDS.openRecent);

describe("File › Open Recent (3.18, PF-1)", () => {
  it("follows Open Site… and lists the 5 latest sites, pinned or not, then Clear Recent", async () => {
    const sites = [
      site("Pinned", 1, { pinned: true }),
      ...[2, 3, 4, 5, 6, 7].map((hour) => site(`Site ${hour}`, hour)),
    ];
    const { registry } = await setUp(api(sites));

    expect(
      registry
        .list()
        .filter((command) => command.menu === "file")
        .map((command) => command.label),
    ).toEqual(["New Site…", "Start a Site…", "Open Site…", "Open Recent"]);
    expect(submenu(registry).map((command) => [command.label, command.separated])).toEqual([
      ["Site 7", undefined],
      ["Site 6", undefined],
      ["Site 5", undefined],
      ["Site 4", undefined],
      ["Site 3", undefined],
      ["Clear Recent", true],
    ]);
    // The renderer knows sites by id only.
    expect(submenu(registry)[0]?.id).toBe(`site.openRecent.${"7".repeat(32)}`);
    // Neither Open Recent nor its sites are in the command box.
    await userEvent.click(screen.getByRole("button", { name: /^Search commands/ }));
    const options = screen.getAllByRole("option").map((option) => option.textContent);
    expect(options.some((option) => /Open Recent|Site 7|Clear Recent/.test(option ?? ""))).toBe(
      false,
    );
  });

  it("names a site's folder when another shown shares its name", async () => {
    const { registry } = await setUp(
      api([
        site("Bakery", 3),
        site("Bakery", 2, { folder: "Old" }),
        site("Florist", 1),
        site("Bakery", 4, { folder: "", fileName: "Bakery copy.wforge" }),
      ]),
    );

    expect(submenu(registry).map((command) => command.label)).toEqual([
      "Bakery (Bakery copy.wforge)",
      "Bakery (Sites)",
      "Bakery (Old)",
      "Florist",
      "Clear Recent",
    ]);
  });

  it("keeps a long name short enough for the menu bar", async () => {
    const { registry } = await setUp(api([site("A".repeat(100), 1)]));

    const label = submenu(registry)[0]?.label ?? "";
    expect(label).toHaveLength(50);
    expect(label.endsWith("…")).toBe(true);
  });

  it("shows a disabled No recent sites when there are none", async () => {
    const { registry } = await setUp(api([]));

    expect(submenu(registry).map((command) => [command.label, command.enabled])).toEqual([
      ["No recent sites", false],
    ]);
  });

  it("opens a site from the keyboard in the title bar, as the start screen does", async () => {
    const fake = api([site("Bakery", 2), site("Florist", 1)]);
    const { restart } = await setUp(fake);

    await userEvent.click(screen.getByRole("menuitem", { name: "File" }));
    const recent = screen.getByRole("menuitem", { name: "Open Recent" });
    expect(recent.getAttribute("aria-haspopup")).toBe("menu");
    recent.focus();
    // The arrow keys open the submenu and leave it.
    await userEvent.keyboard("{ArrowRight}");
    const sub = await screen.findByRole("menu", { name: "Open Recent" });
    await waitFor(() => expect(document.activeElement?.textContent).toBe("Bakery"));
    await userEvent.keyboard("{ArrowLeft}");
    await waitFor(() => expect(screen.queryByRole("menu", { name: "Open Recent" })).toBeNull());
    expect(document.activeElement).toBe(recent);
    await userEvent.keyboard("{ArrowRight}");
    await screen.findByRole("menu", { name: "Open Recent" });
    await userEvent.keyboard("{ArrowDown}{Enter}");

    expect(fake.openRecent).toHaveBeenCalledWith("1".repeat(32));
    expect(restart).toHaveBeenCalledOnce();
    expect(sub.isConnected).toBe(false);
  });

  it("says when a site's file has gone, and lists the sites again without it", async () => {
    const fake = api([site("Bakery", 2), site("Florist", 1)], {
      status: "failed",
      reason: "not-found",
    });
    const { registry, restart } = await setUp(fake);
    fake.listRecent.mockResolvedValue([site("Florist", 1)]);

    await act(async () => {
      registry.run(`site.openRecent.${"2".repeat(32)}`);
    });

    expect(
      await screen.findByText(
        "The site file is no longer there. It may have been moved or deleted.",
      ),
    ).toBeTruthy();
    expect(restart).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(submenu(registry).map((command) => command.label)).toEqual([
        "Florist",
        "Clear Recent",
      ]),
    );
  });

  it("clears the unpinned sites after asking, saying the pinned ones stay", async () => {
    const pinned = site("Pinned", 1, { pinned: true });
    const fake = api([pinned, site("Bakery", 2)]);
    const { registry } = await setUp(fake);
    fake.listRecent.mockResolvedValue([pinned]);

    await act(async () => {
      registry.run(COMMAND_IDS.clearRecent);
    });
    const dialog = await screen.findByRole("alertdialog", {
      name: "Clear the list of recent sites?",
    });
    expect(dialog.textContent).toContain(
      "Sites you've pinned stay, in this menu and on the start screen.",
    );
    // Cancelling clears nothing.
    await userEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(fake.clearRecent).not.toHaveBeenCalled();

    await act(async () => {
      registry.run(COMMAND_IDS.clearRecent);
    });
    await userEvent.click(
      within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Clear Recent" }),
    );
    expect(fake.clearRecent).toHaveBeenCalledOnce();
    // Only the pinned site is left, and nothing more to clear.
    await waitFor(() =>
      expect(submenu(registry).map((command) => [command.label, command.enabled])).toEqual([
        ["Pinned", undefined],
        ["Clear Recent", false],
      ]),
    );
  });

  it("says when the list can't be cleared", async () => {
    const fake = api([site("Bakery", 2)]);
    fake.clearRecent.mockRejectedValueOnce(new Error("disk full"));
    const { registry } = await setUp(fake);

    await act(async () => {
      registry.run(COMMAND_IDS.clearRecent);
    });
    await userEvent.click(
      within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Clear Recent" }),
    );

    expect(
      await screen.findByText("The list of recent sites couldn't be changed. Try again."),
    ).toBeTruthy();
  });
});
