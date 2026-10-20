// @vitest-environment happy-dom
import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CommandRegistryProvider } from "./command-context.js";
import { COMMAND_IDS } from "./command-ids.js";
import { type CommandRegistry, createCommandRegistry } from "./commands.js";
import { PanelRegistryProvider } from "./panel-context.js";
import { createPanelRegistry, type PanelRegistry } from "./panels.js";
import { PANEL_GROUPS, ShellLayout } from "./ShellLayout.js";

afterEach(() => cleanup());

/** A panel in each column, as once 1.13 (Add) and 1.14 (Edit) have contributed theirs. */
function fillColumns(panels: PanelRegistry): void {
  panels.register({ id: "add", slot: "left.top", title: "Add", component: () => <p>Add</p> });
  panels.register({ id: "edit", slot: "right.top", title: "Edit", component: () => <p>Edit</p> });
}

function renderLayout({
  editorLevel = "simple" as const,
  layout = {},
  onLayoutChange = vi.fn(),
  filled = true,
}: {
  editorLevel?: "simple" | "advanced";
  layout?: Record<string, Record<string, number>>;
  onLayoutChange?: (groupId: string, layout: Record<string, number>) => void;
  filled?: boolean;
} = {}) {
  const commands: CommandRegistry = createCommandRegistry();
  const panels: PanelRegistry = createPanelRegistry();
  if (filled) {
    fillColumns(panels);
  }
  const result = render(
    <CommandRegistryProvider registry={commands}>
      <PanelRegistryProvider registry={panels}>
        <ShellLayout
          center={<p>Canvas</p>}
          layout={layout}
          onLayoutChange={onLayoutChange}
          editorLevel={editorLevel}
        />
      </PanelRegistryProvider>
    </CommandRegistryProvider>,
  );
  return { commands, panels, ...result };
}

describe("ShellLayout", () => {
  it("puts the canvas in the middle and an empty state in each slot nobody filled", () => {
    renderLayout();

    expect(screen.getByText("Canvas")).toBeTruthy();
    for (const region of ["Left panels", "Right panels", "Bottom panel"]) {
      expect(
        within(screen.getByRole("region", { name: region })).getAllByText("Nothing here yet"),
      ).not.toHaveLength(0);
    }
  });

  it("shows a column only once one of its slots has a panel", () => {
    const { panels, commands } = renderLayout({ filled: false });

    expect(screen.queryByRole("region", { name: "Left panels" })).toBeNull();
    expect(screen.queryByRole("region", { name: "Right panels" })).toBeNull();
    expect(commands.get(COMMAND_IDS.toggleLeftPanels)?.enabled).toBe(false);

    act(() => {
      panels.register({
        id: "history",
        slot: "left.bottom",
        title: "Undo History",
        component: () => null,
      });
    });

    expect(screen.getByRole("region", { name: "Left panels" })).toBeTruthy();
    expect(screen.queryByRole("region", { name: "Right panels" })).toBeNull();
    expect(commands.get(COMMAND_IDS.toggleLeftPanels)?.enabled).toBe(true);
    expect(commands.get(COMMAND_IDS.toggleRightPanels)?.enabled).toBe(false);
  });

  it("saves nothing on its own: only the person's resizing is remembered", () => {
    const onLayoutChange = vi.fn();
    const { panels } = renderLayout({ filled: false, onLayoutChange });

    act(() => {
      panels.register({ id: "add", slot: "left.top", title: "Add", component: () => null });
    });

    expect(onLayoutChange).not.toHaveBeenCalled();
  });

  it("uses a remembered column layout only while the same columns are shown", () => {
    renderLayout({
      filled: false,
      layout: { [PANEL_GROUPS.columns]: { left: 30, center: 40, right: 30 } },
    });

    expect(screen.getByText("Canvas")).toBeTruthy();
  });

  it("shows a slot's panels as tabs, and Advanced-only ones only in Advanced mode", async () => {
    const { panels, rerender, commands } = renderLayout({ filled: false });
    act(() => {
      panels.register({
        id: "history",
        slot: "left.bottom",
        title: "Undo History",
        component: () => <p>Steps</p>,
      });
      panels.register({
        id: "layers",
        slot: "left.bottom",
        title: "Layers",
        advancedOnly: true,
        order: -1,
        component: () => <p>Tree</p>,
      });
    });

    const left = screen.getByRole("region", { name: "Left panels" });
    expect(
      within(left)
        .getAllByRole("tab")
        .map((tab) => tab.textContent),
    ).toEqual(["Undo History"]);
    expect(within(left).getByText("Steps")).toBeTruthy();

    rerender(
      <CommandRegistryProvider registry={commands}>
        <PanelRegistryProvider registry={panels}>
          <ShellLayout center={null} layout={{}} onLayoutChange={vi.fn()} editorLevel="advanced" />
        </PanelRegistryProvider>
      </CommandRegistryProvider>,
    );
    const tabs = within(screen.getByRole("region", { name: "Left panels" })).getAllByRole("tab");
    expect(tabs.map((tab) => tab.textContent)).toEqual(["Layers", "Undo History"]);
    await userEvent.click(tabs[1] as HTMLElement);
    expect(screen.getByText("Steps")).toBeTruthy();
  });

  it("labels its splitters so they can be found and moved with the keyboard", () => {
    renderLayout();

    for (const name of [
      "Resize the left panels",
      "Resize the right panels",
      "Resize the bottom panel",
      "Resize the left panels' top and bottom",
      "Resize the right panels' top and bottom",
    ]) {
      expect(screen.getByRole("separator", { name })).toBeTruthy();
    }
  });

  it("offers the panel toggles and Reset Panels in the View menu", () => {
    const { commands, unmount } = renderLayout();

    for (const id of [
      COMMAND_IDS.toggleLeftPanels,
      COMMAND_IDS.toggleRightPanels,
      COMMAND_IDS.toggleDrawer,
      COMMAND_IDS.resetPanels,
    ]) {
      expect(commands.get(id)?.menu).toBe("view");
      expect(() => act(() => void commands.run(id))).not.toThrow();
    }
    unmount();
    expect(commands.list()).toEqual([]);
  });

  it("starts from the remembered sizes and doesn't save them again unchanged", () => {
    const onLayoutChange = vi.fn();
    renderLayout({
      layout: { [PANEL_GROUPS.left]: { "left.top": 70, "left.bottom": 30 } },
      onLayoutChange,
    });

    const top = screen
      .getByRole("region", { name: "Left panels" })
      .querySelector('[data-panel][id="left.top"]');
    expect(top?.getAttribute("style") ?? "").toContain("70");
    expect(onLayoutChange).not.toHaveBeenCalledWith(PANEL_GROUPS.left, expect.anything());
  });
});
