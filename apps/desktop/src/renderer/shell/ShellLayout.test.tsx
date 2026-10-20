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

function renderLayout({
  editorLevel = "simple" as const,
  layout = {},
  onLayoutChange = vi.fn(),
}: {
  editorLevel?: "simple" | "advanced";
  layout?: Record<string, Record<string, number>>;
  onLayoutChange?: (groupId: string, layout: Record<string, number>) => void;
} = {}) {
  const commands: CommandRegistry = createCommandRegistry();
  const panels: PanelRegistry = createPanelRegistry();
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

  it("shows a slot's panels as tabs, and Advanced-only ones only in Advanced mode", async () => {
    const { panels, rerender, commands } = renderLayout();
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
