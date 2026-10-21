// @vitest-environment happy-dom
import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { siteLibrary } from "@webforge/site-components";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createEditorSession } from "../editor/editor-session.js";
import { starterSite } from "../editor/starter-site.js";
import { CommandRegistryProvider } from "../shell/command-context.js";
import { createCommandRegistry } from "../shell/commands.js";
import { createPanelRegistry, panelsInSlot } from "../shell/panels.js";
import { registerLayersPanel } from "./register-layers-panel.js";

afterEach(cleanup);

function setUp() {
  const session = createEditorSession(siteLibrary, starterSite());
  const panels = createPanelRegistry();
  const commands = createCommandRegistry();
  const remove = registerLayersPanel(panels, session);
  const panel = panels.list()[0];
  if (panel === undefined) throw new Error("not registered");
  const Layers = panel.component;
  render(
    <CommandRegistryProvider registry={commands}>
      <Layers />
    </CommandRegistryProvider>,
  );
  return { session, panels, commands, remove };
}

describe("registerLayersPanel", () => {
  it("adds Layers before Undo History, in Advanced mode only (T2)", () => {
    const { panels, remove } = setUp();
    panels.register({
      id: "undoHistory",
      slot: "left.bottom",
      title: "Undo History",
      component: () => null,
    });

    expect(panelsInSlot(panels.list(), "left.bottom", "simple").map((p) => p.id)).toEqual([
      "undoHistory",
    ]);
    expect(panelsInSlot(panels.list(), "left.bottom", "advanced").map((p) => p.id)).toEqual([
      "layers",
      "undoHistory",
    ]);
    remove();
    expect(panels.list().map((p) => p.id)).toEqual(["undoHistory"]);
  });

  it("selects in step with the canvas, both ways", async () => {
    const { session } = setUp();
    const rows = () => screen.getAllByRole("treeitem");

    await userEvent.click(rows()[1] as HTMLElement);
    expect(session.ui.getState().nodeId).toBe("heading-1");

    act(() => session.ui.setState({ nodeId: "text-1" }));
    expect(rows()[2]?.getAttribute("aria-selected")).toBe("true");
  });

  it("follows changes to the page, and runs the canvas's commands from its toolbar", async () => {
    const { session, commands } = setUp();
    const run = vi.fn();
    commands.register({ id: "edit.duplicate", label: "Duplicate", run });
    commands.register({ id: "edit.delete", label: "Delete", enabled: false, run: vi.fn() });

    act(() => session.ui.setState({ nodeId: "heading-1" }));
    const toolbar = () => within(screen.getByRole("toolbar", { name: "Layer actions" }));
    await userEvent.click(toolbar().getByRole("button", { name: "Hide Heading" }));
    expect(toolbar().getByRole("button", { name: "Show Heading" })).toBeTruthy();
    expect(session.history.entries().map((entry) => entry.label)).toEqual(["Hid Heading"]);

    await userEvent.click(screen.getByRole("button", { name: "Duplicate" }));
    expect(run).toHaveBeenCalledOnce();
    expect((screen.getByRole("button", { name: "Delete" }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    expect((screen.getByRole("button", { name: "Move up" }) as HTMLButtonElement).disabled).toBe(
      true,
    );

    act(() => session.history.undo());
    expect(toolbar().getByRole("button", { name: "Hide Heading" })).toBeTruthy();
  });
});
