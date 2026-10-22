// @vitest-environment happy-dom
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { siteLibrary } from "@webforge/site-components";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createEditorSession, currentPage } from "../editor/editor-session.js";
import { starterSite } from "../editor/starter-site.js";
import { PanelRegistryProvider, usePanels } from "../shell/panel-context.js";
import { createPanelRegistry, type PanelRegistry } from "../shell/panels.js";
import { AddPanel } from "./AddPanel.js";
import { addComponent, addItems } from "./add-items.js";
import { registerAddPanel } from "./register-add-panel.js";

afterEach(cleanup);

const button = (name: string) => screen.getByRole("button", { name });

describe("AddPanel (F-ED-1)", () => {
  const setUp = (canAdd = (_type: string) => true) => {
    const onAdd = vi.fn();
    const onTabChange = vi.fn();
    const props = {
      sections: addItems(siteLibrary, "sections"),
      elements: addItems(siteLibrary, "elements"),
      onAdd,
      onTabChange,
      canAdd,
      point: null,
      onCancelPoint: vi.fn(),
    };
    const view = render(<AddPanel {...props} tab="sections" />);
    return {
      onAdd,
      onTabChange,
      show: (tab: "sections" | "elements") => view.rerender(<AddPanel {...props} tab={tab} />),
    };
  };

  it("lists sections by category and adds the one clicked", async () => {
    const { onAdd } = setUp();

    expect(screen.getByRole("list", { name: "Heroes" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Header" })).toBeNull();
    await userEvent.click(button("Hero"));

    expect(onAdd).toHaveBeenCalledExactlyOnceWith("Hero");
  });

  it("filters by what is typed, and says when nothing matches", async () => {
    setUp();

    await userEvent.type(
      screen.getByRole("searchbox", { name: "Search sections and elements" }),
      "hero",
    );
    expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual(["Hero"]);
    await userEvent.type(screen.getByRole("searchbox"), "es and more");

    expect(screen.getByText("Nothing matches 'heroes and more'.")).toBeTruthy();
  });

  it("switches tabs, and disables elements with nowhere to go", async () => {
    const { onTabChange, show } = setUp(() => false);

    await userEvent.click(screen.getByRole("tab", { name: "Elements" }));
    expect(onTabChange).toHaveBeenCalledWith("elements");
    show("elements");

    expect((button("Heading") as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("Add a section first: elements go inside sections.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Question" })).toBeNull();
  });
});

describe("dragging from the Add panel", () => {
  it("makes every item it can add a drag source, until it goes", () => {
    const stops = new Map<string, ReturnType<typeof vi.fn>>();
    const dragSource = vi.fn((element: HTMLElement, type: string) => {
      const stop = vi.fn();
      stops.set(type, stop);
      expect(element.textContent).toContain(type === "Faq" ? "FAQ" : type);
      return stop;
    });
    const props = {
      sections: addItems(siteLibrary, "sections"),
      elements: addItems(siteLibrary, "elements"),
      tab: "sections" as const,
      onTabChange: vi.fn(),
      onAdd: vi.fn(),
      canAdd: (type: string) => type !== "Faq",
      point: null,
      onCancelPoint: vi.fn(),
      dragSource,
    };
    const view = render(<AddPanel {...props} />);

    // Not the FAQ, which has nowhere to go.
    expect(dragSource.mock.calls.map(([, type]) => type)).toEqual(["Section", "Hero"]);
    expect(button("Hero").className).toContain("relative");
    view.unmount();

    expect(stops.get("Hero")).toHaveBeenCalledOnce();
    expect(stops.get("Section")).toHaveBeenCalledOnce();
  });
});

describe("registerAddPanel", () => {
  function AddHost() {
    const panel = usePanels().find((entry) => entry.id === "add");
    return panel === undefined ? null : <panel.component />;
  }
  const Host = ({ panels }: { readonly panels: PanelRegistry }) => (
    <PanelRegistryProvider registry={panels}>
      <AddHost />
    </PanelRegistryProvider>
  );

  it("opens at the + button's place and adds the chosen section there, then forgets the place", async () => {
    const session = createEditorSession(siteLibrary, starterSite());
    const panels = createPanelRegistry();
    const shown = vi.fn();
    panels.onShow(shown);
    const flush = vi.fn();
    const addPanel = registerAddPanel(panels, session, { flush });
    render(<Host panels={panels} />);

    act(() => addPanel.openAt({ index: 1 }));
    expect(shown).toHaveBeenCalledWith("add");
    expect(screen.getByRole("status").textContent).toContain(
      "Choose a section to add after Section.",
    );
    await userEvent.click(button("FAQ"));

    expect(flush).toHaveBeenCalled();
    expect(currentPage(session)?.doc.content.map((node) => node.type)).toEqual(["Section", "Faq"]);
    expect(screen.queryByRole("status")).toBeNull();
    addPanel.remove();
    expect(panels.list()).toEqual([]);
  });

  it("keeps the + button's place with its section while the page changes, and drops it once gone", async () => {
    const session = createEditorSession(siteLibrary, starterSite());
    const panels = createPanelRegistry();
    const addPanel = registerAddPanel(panels, session);
    render(<Host panels={panels} />);

    act(() => addPanel.openAt({ index: 1 }));
    // A Hero added at the top moves the Section down: the place stays after the Section.
    act(() => void addComponent(session, "Hero", { index: 0 }));
    await userEvent.click(button("FAQ"));
    expect(currentPage(session)?.doc.content.map((node) => node.type)).toEqual([
      "Hero",
      "Section",
      "Faq",
    ]);

    act(() => addPanel.openAt({ index: 3 }));
    expect(screen.getByRole("status").textContent).toContain("after FAQ");
    act(() => session.history.undo());
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("forgets the + button's place when cancelled or when another page is shown", async () => {
    const session = createEditorSession(siteLibrary, starterSite());
    const panels = createPanelRegistry();
    const addPanel = registerAddPanel(panels, session);
    render(<Host panels={panels} />);

    act(() => addPanel.openAt({ index: 0 }));
    expect(screen.getByRole("status").textContent).toContain("at the top of the page");
    await userEvent.click(button("Cancel"));
    expect(screen.queryByRole("status")).toBeNull();

    act(() => addPanel.openAt({ index: 0 }));
    const other = session.history.document.getState().pageOrder[1];
    if (other === undefined) throw new Error("no second page");
    act(() => session.ui.setState({ pageId: other }));

    expect(screen.queryByRole("status")).toBeNull();
  });
});
