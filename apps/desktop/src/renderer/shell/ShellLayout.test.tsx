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
  it("shows a panel that throws as a fallback in its tab; the rest keeps working (R3)", async () => {
    // React reports the caught error on the console; in the app, the root reports it instead.
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    let broken = true;
    const { panels } = renderLayout();
    act(() => {
      panels.register({
        id: "layers",
        slot: "left.top",
        title: "Layers",
        component: () => {
          if (broken) throw new Error("Rosa's Bakery");
          return <p>Layers</p>;
        },
      });
    });
    const left = within(screen.getByRole("region", { name: "Left panels" }));
    await userEvent.setup().click(left.getByRole("tab", { name: "Layers" }));

    expect(left.getByRole("alert").textContent).toBe(
      "Something went wrong in this panel. Your work is saved.Reload panel",
    );
    expect(screen.getByText("Canvas")).toBeTruthy();
    expect(
      within(screen.getByRole("region", { name: "Right panels" })).getByText("Edit", {
        selector: "p",
      }),
    ).toBeTruthy();
    broken = false;
    await userEvent.setup().click(left.getByRole("button", { name: "Reload panel" }));
    expect(left.getByText("Layers", { selector: "p" })).toBeTruthy();
    // Its neighbour in the column was never touched.
    await userEvent.setup().click(left.getByRole("tab", { name: "Add" }));
    expect(left.getByText("Add", { selector: "p" })).toBeTruthy();
    log.mockRestore();
  });

  it("shows the canvas's fallback when it throws, and keeps the panels (R3)", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    function BrokenCanvas(): never {
      throw new Error("Rosa's Bakery");
    }
    render(
      <CommandRegistryProvider registry={createCommandRegistry()}>
        <PanelRegistryProvider
          registry={(() => {
            const panels = createPanelRegistry();
            fillColumns(panels);
            return panels;
          })()}
        >
          <ShellLayout
            center={<BrokenCanvas />}
            layout={{}}
            onLayoutChange={vi.fn()}
            editorLevel="simple"
          />
        </PanelRegistryProvider>
      </CommandRegistryProvider>,
    );

    expect(screen.getByRole("alert").textContent).toContain(
      "Something went wrong showing this page",
    );
    expect(screen.getByRole("button", { name: "Reload page" })).toBeTruthy();
    expect(
      within(screen.getByRole("region", { name: "Left panels" })).getByText("Add", {
        selector: "p",
      }),
    ).toBeTruthy();
    log.mockRestore();
  });

  it("puts the canvas in the middle, panels around it and an empty state in the drawer", () => {
    renderLayout();

    expect(screen.getByText("Canvas")).toBeTruthy();
    expect(
      within(screen.getByRole("region", { name: "Left panels" })).getByText("Add", {
        selector: "p",
      }),
    ).toBeTruthy();
    expect(
      within(screen.getByRole("region", { name: "Bottom panel" })).getByText("Nothing here yet"),
    ).toBeTruthy();
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

  it("gives columns that appear after the first render their remembered sizes", async () => {
    const { panels } = renderLayout({
      filled: false,
      layout: { [PANEL_GROUPS.columns]: { left: 30, center: 45, right: 25 } },
    });
    const flexOf = (id: string) =>
      document.querySelector<HTMLElement>(`[data-panel][id="${id}"]`)?.style.flexGrow;

    await act(async () => {
      fillColumns(panels);
      await new Promise((resolve) => requestAnimationFrame(resolve));
    });

    expect(flexOf("left")).toBe("30");
    expect(flexOf("right")).toBe("25");
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

  it("shows one panel of a column at a time: the top slot's tabs, then the bottom slot's", async () => {
    const { panels } = renderLayout();
    act(() => {
      panels.register({
        id: "site",
        slot: "right.bottom",
        title: "Site",
        component: () => <p>Pages</p>,
      });
    });

    const right = screen.getByRole("region", { name: "Right panels" });
    const tabs = within(right).getAllByRole("tab");
    expect(tabs.map((tab) => tab.textContent)).toEqual(["Edit", "Site"]);
    expect(within(right).getByText("Edit", { selector: "p" })).toBeTruthy();
    expect(within(right).queryByText("Pages")).toBeNull();

    await userEvent.click(tabs[1] as HTMLElement);

    expect(within(right).getByText("Pages")).toBeTruthy();
    expect(within(right).queryByText("Edit", { selector: "p" })).toBeNull();

    // The chosen tab stays while panels come and go.
    act(() => {
      panels.register({ id: "theme", slot: "right.top", title: "Theme", component: () => null });
    });
    expect(within(right).getByText("Pages")).toBeTruthy();
  });

  it("brings a panel asked for to the front of its column", () => {
    const { panels } = renderLayout();
    act(() => {
      panels.register({
        id: "history",
        slot: "left.bottom",
        title: "Undo History",
        component: () => <p>Steps</p>,
      });
    });
    const left = screen.getByRole("region", { name: "Left panels" });
    act(() => panels.show("history"));
    expect(within(left).getByText("Steps")).toBeTruthy();

    // A panel of another column, or none, changes nothing here.
    act(() => panels.show("edit"));
    act(() => panels.show("nothing"));
    expect(within(left).getByText("Steps")).toBeTruthy();
    act(() => panels.show("add"));
    expect(within(left).getByText("Add", { selector: "p" })).toBeTruthy();
  });

  describe("the left column's lower pane (ADR 0011)", () => {
    /** Add and Undo History as tabs, and Layers under them. */
    function leftColumn(panels: PanelRegistry) {
      act(() => {
        panels.register({
          id: "history",
          slot: "left.bottom",
          title: "Undo History",
          component: () => <p>Steps</p>,
        });
        panels.register({
          id: "layers",
          slot: "left.lower",
          title: "Layers",
          component: () => <p>Tree</p>,
        });
      });
      return within(screen.getByRole("region", { name: "Left panels" }));
    }
    const flexOf = (id: string) =>
      document.querySelector<HTMLElement>(`[data-panel][id="${id}"]`)?.style.flexGrow;

    it("shows Layers under the tabs, at the same time, in Simple mode, 60/40 at first", async () => {
      const { panels } = renderLayout();
      const left = leftColumn(panels);

      expect(left.getAllByRole("tab").map((tab) => tab.textContent)).toEqual([
        "Add",
        "Undo History",
        "Layers",
      ]);
      expect(left.getByText("Add", { selector: "p" })).toBeTruthy();
      expect(left.getByText("Tree")).toBeTruthy();
      await userEvent.setup().click(left.getByRole("tab", { name: "Undo History" }));
      expect(left.getByText("Steps")).toBeTruthy();
      expect(left.getByText("Tree")).toBeTruthy();
      expect(screen.getByRole("separator", { name: "Resize Layers" })).toBeTruthy();
      await act(async () => new Promise<number>((resolve) => requestAnimationFrame(resolve)));
      expect(flexOf("lower")).toBe("40");
    });

    // Reset Panels' 60/40 needs real sizes to apply: e2e/app/layers-always.spec.ts checks it.
    it("starts from the remembered split, without saving it again", async () => {
      const onLayoutChange = vi.fn();
      const { panels } = renderLayout({
        layout: { [PANEL_GROUPS.left]: { tabs: 75, lower: 25 } },
        onLayoutChange,
      });
      leftColumn(panels);
      await act(async () => new Promise<number>((resolve) => requestAnimationFrame(resolve)));
      expect(flexOf("lower")).toBe("25");
      expect(onLayoutChange).not.toHaveBeenCalledWith(PANEL_GROUPS.left, expect.anything());
    });

    it("keeps the left column one tab set while nothing is in the lower pane", () => {
      renderLayout();

      expect(document.querySelector('[data-panel][id="lower"]')).toBeNull();
      expect(screen.queryByRole("separator", { name: "Resize Layers" })).toBeNull();
    });
  });

  it("labels its splitters so they can be found and moved with the keyboard", () => {
    renderLayout();

    for (const name of [
      "Resize the left panels",
      "Resize the right panels",
      "Resize the bottom panel",
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

  it("starts a column left collapsed as its strip of panel icons, not its squeezed tabs", () => {
    // 2% of the window: the 36 px strip, as saved when the column was collapsed.
    const width = (36 / window.innerWidth) * 100;
    renderLayout({
      layout: { [PANEL_GROUPS.columns]: { left: width, center: 100 - width - 20, right: 20 } },
    });

    expect(screen.getByRole("navigation", { name: "Left panels, collapsed" })).toBeTruthy();
    expect(screen.queryByRole("region", { name: "Left panels" })).toBeNull();
    expect(screen.queryByRole("navigation", { name: "Right panels, collapsed" })).toBeNull();
  });

  it("starts from the remembered sizes and doesn't save them again unchanged", () => {
    const onLayoutChange = vi.fn();
    renderLayout({
      layout: { [PANEL_GROUPS.center]: { canvas: 70, drawer: 30 } },
      onLayoutChange,
    });

    const canvas = document.querySelector('[data-panel][id="canvas"]');
    expect(canvas?.getAttribute("style") ?? "").toContain("70");
    expect(onLayoutChange).not.toHaveBeenCalledWith(PANEL_GROUPS.center, expect.anything());
  });
});
