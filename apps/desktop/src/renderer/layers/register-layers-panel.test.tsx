// @vitest-environment happy-dom
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  copiedNodeId,
  SHARED_COPY_TYPE,
  type SharedSectionId,
  type SiteDoc,
} from "@webforge/model";
import { siteLibrary } from "@webforge/site-components";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createEditorSession } from "../editor/editor-session.js";
import { starterSite } from "../editor/starter-site.js";
import { CommandRegistryProvider } from "../shell/command-context.js";
import { createCommandRegistry } from "../shell/commands.js";
import { createPanelRegistry, panelsInSlot } from "../shell/panels.js";
import { registerLayersPanel } from "./register-layers-panel.js";

afterEach(cleanup);

function setUp(site: SiteDoc = starterSite()) {
  const session = createEditorSession(siteLibrary, site);
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

  it("marks a linked copy, selected while the copy is, not an element inside it (F-ED-23)", () => {
    const hours = "shared-hours" as SharedSectionId;
    const site = starterSite();
    site.pages[site.homePageId]?.doc.content.push({
      type: SHARED_COPY_TYPE,
      props: { id: "c1", sharedSectionId: hours },
    });
    const { session } = setUp({
      ...site,
      sharedSections: {
        [hours]: {
          id: hours,
          name: "Opening hours",
          section: {
            type: "Section",
            props: { id: "s", content: [{ type: "Heading", props: { id: "t" } }] },
          },
        },
      },
    });
    const copy = screen.getByRole("treeitem", { name: /Linked copy of 'Opening hours'/ });
    expect(copy.textContent).toContain("Opening hours Section");

    act(() => session.ui.setState({ nodeId: copiedNodeId("c1", "s") }));
    expect(copy.getAttribute("aria-selected")).toBe("true");
    // Layers' actions act on the selection: an element inside the copy isn't the copy.
    act(() => session.ui.setState({ nodeId: copiedNodeId("c1", "t") }));
    expect(copy.getAttribute("aria-selected")).toBe("false");
  });

  it("renames from the element menu, and gives the row the focus back when it closes (1.35)", async () => {
    const { session } = setUp();
    const heading = () => screen.getByRole("treeitem", { name: /Heading/ });
    const menu = () => within(screen.getByRole("menu", { name: "Element actions" }));

    await userEvent.pointer({ keys: "[MouseRight]", target: heading() });
    await userEvent.click(menu().getByRole("menuitem", { name: "Rename" }));
    await userEvent.keyboard("Intro{Enter}");

    expect(session.history.entries().at(-1)?.label).toBe("Renamed Heading to 'Intro'");

    await userEvent.pointer({ keys: "[MouseRight]", target: heading() });
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(document.activeElement).toBe(heading()));
  });
});
