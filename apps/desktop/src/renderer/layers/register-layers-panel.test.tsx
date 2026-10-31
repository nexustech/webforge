// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  copiedNodeId,
  type NodeDoc,
  SHARED_COPY_TYPE,
  type SharedSectionId,
  type SiteDoc,
} from "@webforge/model";
import { afterEach, describe, expect, it, vi } from "vitest";
import { starterSite } from "../../shared/starter-site.js";
import { currentPage } from "../editor/editor-session.js";
import { copyLayer } from "../editor/layers.js";
import { selectedIds } from "../editor/selection.js";
import { CommandRegistryProvider } from "../shell/command-context.js";
import { createCommandRegistry, isMac } from "../shell/commands.js";
import { createPanelRegistry, panelsInSlot } from "../shell/panels.js";
import { sessionWith } from "../testing/fixtures.js";
import { dragRow } from "../testing/row-drag.js";
import { registerLayersPanel } from "./register-layers-panel.js";

afterEach(cleanup);

function setUp(site: SiteDoc = starterSite()) {
  const session = sessionWith(site);
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
  it("adds Layers under the left column's tabs, in Simple and Advanced mode (ADR 0011)", () => {
    const { panels, remove } = setUp();
    panels.register({
      id: "undoHistory",
      slot: "left.bottom",
      title: "Undo History",
      component: () => null,
    });

    // Not a tab beside Undo History: a pane of its own, shown with it.
    expect(panelsInSlot(panels.list(), "left.bottom", "simple").map((p) => p.id)).toEqual([
      "undoHistory",
    ]);
    for (const level of ["simple", "advanced"] as const) {
      expect(panelsInSlot(panels.list(), "left.lower", level).map((p) => p.id)).toEqual(["layers"]);
    }
    remove();
    expect(panels.list().map((p) => p.id)).toEqual(["undoHistory"]);
  });

  it("selects in step with the canvas, both ways", async () => {
    const { session } = setUp();
    const rows = () => screen.getAllByRole("treeitem");

    // The shared Header comes first (#673).
    await userEvent.click(rows()[2] as HTMLElement);
    expect(session.ui.getState().nodeId).toBe("heading-1");

    act(() => session.select("text-1"));
    expect(rows()[3]?.getAttribute("aria-selected")).toBe("true");
  });

  it("never moves one layer alone while several are selected (#259 review)", () => {
    // Alt+arrows hand several to the Edit menu's moves, which this panel alone doesn't have.
    const { session } = setUp();
    const order = () =>
      ((currentPage(session)?.doc.content[0]?.props.content ?? []) as NodeDoc[]).map(
        (node) => node.props.id,
      );
    const before = order();
    act(() => session.selectElements(["heading-1", "text-1"]));

    fireEvent.keyDown(screen.getAllByRole("treeitem")[2] as HTMLElement, {
      key: "ArrowDown",
      altKey: true,
      ...(isMac() ? { metaKey: true } : { ctrlKey: true }),
    });

    expect(order()).toEqual(before);
    expect(session.history.entries()).toHaveLength(0);
    expect(selectedIds(session.ui.getState())).toEqual(["heading-1", "text-1"]);
  });

  it("moves or copies a row dragged while others are selected, alone, and selects it (#269 review)", () => {
    const { session } = setUp();
    const order = () =>
      ((currentPage(session)?.doc.content[0]?.props.content ?? []) as NodeDoc[]).map(
        (node) => node.props.id,
      );
    const drag = (from: number, to: number, copy = false) => {
      const rows = screen.getAllByRole("treeitem");
      dragRow(rows[from] as HTMLElement, rows[to] as HTMLElement, {
        ctrlKey: copy,
        metaKey: copy,
      });
    };
    act(() => session.selectElements(["section-1", "heading-1"]));

    // The Text, not selected, dragged before the Heading (the Header is first, #673).
    drag(3, 2);
    expect(order()).toEqual(["text-1", "heading-1"]);
    expect(selectedIds(session.ui.getState())).toEqual(["text-1"]);

    act(() => session.selectElements(["section-1", "text-1"]));
    drag(3, 2, true);
    expect(order()).toHaveLength(3);
    expect(selectedIds(session.ui.getState())).toHaveLength(1);
    expect(session.history.entries().map((entry) => entry.label)).toEqual([
      "Moved Text",
      "Duplicated Heading",
    ]);
  });

  it("follows changes to the page, and runs the canvas's commands from its toolbar", async () => {
    const { session, commands } = setUp();
    const run = vi.fn();
    commands.register({ id: "edit.duplicate", label: "Duplicate", run });
    commands.register({ id: "edit.delete", label: "Delete", enabled: false, run: vi.fn() });

    act(() => session.select("heading-1"));
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

    act(() => session.select(copiedNodeId("c1", "s")));
    expect(copy.getAttribute("aria-selected")).toBe("true");
    // Layers' actions act on the selection: an element inside the copy isn't the copy.
    act(() => session.select(copiedNodeId("c1", "t")));
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

describe("Layers' shared Header and Footer (#673)", () => {
  const labels = (session: ReturnType<typeof setUp>["session"]) =>
    session.history.entries().map((entry) => entry.label);
  const rowsNamed = () => screen.getAllByRole("treeitem").map((row) => row.dataset.layer);

  it("lists the Header first and the Footer last, each marked as on every page", () => {
    setUp();

    const rows = rowsNamed();
    expect(rows[0]).toBe("header");
    expect(rows.at(-1)).toBe("footer");
    for (const id of ["header", "footer"]) {
      const row = document.querySelector(`[data-layer="${id}"]`);
      expect(row?.textContent).toContain("On every page");
      // Never dragged among the page's sections.
      expect(row?.getAttribute("draggable")).not.toBe("true");
    }
  });

  it("selects the Header or Footer in step with the canvas, both ways", async () => {
    const { session } = setUp();
    const row = (id: string) => document.querySelector(`[data-layer="${id}"]`) as HTMLElement;

    act(() => session.select("footer"));
    expect(row("footer").getAttribute("aria-selected")).toBe("true");
    await userEvent.click(row("header"));
    expect(session.ui.getState().nodeId).toBe("header");
  });

  it("hides the Header on this page only, as Page Settings' setting, one step undone at once", async () => {
    const { session } = setUp();
    const site = () => session.history.document.getState();
    const { pageId } = session.ui.getState();
    const others = Object.keys(site().pages).filter((id) => id !== pageId);

    await userEvent.click(screen.getByRole("button", { name: "Hide Header" }));

    expect(site().pages[pageId as keyof SiteDoc["pages"]]?.settings.hideHeader).toBe(true);
    for (const id of others) {
      expect(site().pages[id as keyof SiteDoc["pages"]]?.settings.hideHeader).toBe(false);
    }
    expect(labels(session)).toEqual(["Hid the Header on this page"]);
    // Dimmed, as other hidden layers are, and shown again from the same button.
    expect(screen.getByRole("button", { name: "Show Header" })).toBeTruthy();

    act(() => session.history.undo());
    expect(site().pages[pageId as keyof SiteDoc["pages"]]?.settings.hideHeader).toBe(false);
    expect(screen.getByRole("button", { name: "Hide Header" })).toBeTruthy();
  });

  it("shows a Header hidden on every page again from its eye, not hiding it twice (#684 review)", async () => {
    const site = starterSite();
    // Mod+/ on the Header hides the section itself, on every page.
    const header = site.layout.header[0];
    if (header === undefined) throw new Error("no header");
    header.props.hidden = true;
    const { session } = setUp(site);
    const doc = () => session.history.document.getState();
    const { pageId } = session.ui.getState();

    await userEvent.click(screen.getByRole("button", { name: "Show Header" }));

    expect(doc().layout.header[0]?.props.hidden).toBeUndefined();
    expect(doc().pages[pageId as keyof SiteDoc["pages"]]?.settings.hideHeader).toBe(false);
    expect(labels(session)).toEqual(["Showed the Header on this page"]);
    expect(screen.getByRole("button", { name: "Hide Header" })).toBeTruthy();
  });

  it("names the step for the Header, whatever its first section is (#684 review)", async () => {
    const site = starterSite();
    site.layout.header = [{ type: "Hero", props: { id: "banner", heading: "Welcome" } }];
    const { session } = setUp(site);
    const row = document.querySelector('[data-layer="banner"]') as HTMLElement;

    await userEvent.click(within(row).getByRole("button", { name: /^Hide / }));

    expect(labels(session)).toEqual(["Hid the Header on this page"]);
  });

  it("says why an element of the Footer isn't copied (#684 review)", () => {
    const { session } = setUp();

    expect(copyLayer(session, "footer", 0, false)).toBe(
      "Elements of the Footer can't be copied: it's the same on every page.",
    );
    expect(session.history.entries()).toHaveLength(0);
  });

  it("renames the Footer from Layers, on every page, as one step", async () => {
    const { session } = setUp();
    const footer = () => document.querySelector('[data-layer="footer"]') as HTMLElement;

    await userEvent.dblClick(footer());
    await userEvent.keyboard("Contact strip{Enter}");

    expect(session.history.document.getState().layout.footer[0]?.props.layerName).toBe(
      "Contact strip",
    );
    expect(labels(session)).toEqual(["Renamed Footer to 'Contact strip'"]);
  });

  it("keeps a page's section from going above the Header, and reorders the Footer's own", () => {
    const site = starterSite();
    const extra: NodeDoc = { type: "Footer", props: { id: "footer-2", text: "Small print" } };
    site.layout.footer.push(extra);
    const { session } = setUp(site);
    const row = (id: string) => document.querySelector(`[data-layer="${id}"]`) as HTMLElement;
    const sections = () =>
      (currentPage(session)?.doc.content ?? []).map((node) => node.props.id as string);
    const before = sections();

    dragRow(row("section-1"), row("header"));
    expect(sections()).toEqual(before);
    expect(session.history.entries()).toHaveLength(0);

    // Two in the Footer: they move among themselves, first the second.
    dragRow(row("footer-2"), row("footer"));
    expect(session.history.document.getState().layout.footer.map((node) => node.props.id)).toEqual([
      "footer-2",
      "footer",
    ]);
    expect(labels(session)).toEqual(["Moved Footer"]);
  });
});
