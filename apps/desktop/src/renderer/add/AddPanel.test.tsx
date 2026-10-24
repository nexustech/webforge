// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  copiedNodeId,
  SHARED_COPY_TYPE,
  type SharedSectionId,
  type SiteDoc,
} from "@webforge/model";
import { siteLibrary } from "@webforge/site-components";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_PREFERENCES } from "../../shared/ipc/prefs.js";
import { createEditorSession, currentPage } from "../editor/editor-session.js";
import { starterSite } from "../editor/starter-site.js";
import { saveAsSharedSection } from "../shared-sections/shared-sections.js";
import { createCommandRegistry } from "../shell/commands.js";
import { PanelRegistryProvider, usePanels } from "../shell/panel-context.js";
import { createPanelRegistry, type PanelRegistry } from "../shell/panels.js";
import { createPreferencesStore } from "../shell/preferences-store.js";
import { AddPanel } from "./AddPanel.js";
import { addComponent, addItems } from "./add-items.js";
import { registerAddPanel } from "./register-add-panel.js";

afterEach(cleanup);

const button = (name: string) => screen.getByRole("button", { name });

const HOURS = "shared-hours" as SharedSectionId;

/** The starter site with a shared section, "Opening hours", and a copy of it on the home page. */
function withHours(): SiteDoc {
  const site = starterSite();
  site.pages[site.homePageId]?.doc.content.push({
    type: SHARED_COPY_TYPE,
    props: { id: "c1", sharedSectionId: HOURS },
  });
  return {
    ...site,
    sharedSections: {
      [HOURS]: {
        id: HOURS,
        name: "Opening hours",
        section: { type: "Section", props: { id: "s", content: [] } },
      },
    },
  };
}

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
      expect(element.textContent).toContain(siteLibrary.components[type]?.label ?? type);
      return stop;
    });
    const props = {
      sections: [
        {
          type: HOURS,
          label: "Opening hours",
          category: "Shared sections",
          sharedSectionId: HOURS,
        },
        ...addItems(siteLibrary, "sections"),
      ],
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

    // Not the FAQ, which has nowhere to go, nor a shared section: copies are placed by a click.
    expect(dragSource.mock.calls.map(([, type]) => type)).toEqual([
      "Section",
      "Hero",
      "TextSection",
      "TextImage",
      "CallToAction",
    ]);
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
    act(() => session.showPage(other));

    expect(screen.queryByRole("status")).toBeNull();
  });

  it("lists the site's shared sections first, and places a copy of one at the + button's place", async () => {
    const session = createEditorSession(siteLibrary, withHours());
    const panels = createPanelRegistry();
    const addPanel = registerAddPanel(panels, session);
    render(<Host panels={panels} />);
    const groups = () =>
      screen.getAllByRole("list").map((list) => list.getAttribute("aria-label") ?? "");
    expect(groups()[0]).toBe("Shared sections");

    // The + after the copy names it after its shared section.
    act(() => addPanel.openAt({ index: 2 }));
    expect(screen.getByRole("status").textContent).toContain("after 'Opening hours'");
    await userEvent.click(button("Opening hours"));

    const content = currentPage(session)?.doc.content ?? [];
    expect(content.map((node) => node.props.sharedSectionId ?? node.type)).toEqual([
      "Section",
      HOURS,
      HOURS,
    ]);
    expect(session.ui.getState().nodeId).toBe(copiedNodeId(content[2]?.props.id ?? "", "s"));
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("lists a shared section once the site has one, and none once it is gone", () => {
    const session = createEditorSession(siteLibrary, starterSite());
    const panels = createPanelRegistry();
    registerAddPanel(panels, session);
    render(<Host panels={panels} />);
    expect(screen.queryByRole("list", { name: "Shared sections" })).toBeNull();

    act(() =>
      session.edit("insert", "Saved", (draft) => {
        draft.sharedSections[HOURS] = {
          id: HOURS,
          name: "Opening hours",
          section: { type: "Section", props: { id: "s", content: [] } },
        };
      }),
    );
    expect(screen.getByRole("list", { name: "Shared sections" }).textContent).toBe("Opening hours");
    act(() => session.history.undo());
    expect(screen.queryByRole("list", { name: "Shared sections" })).toBeNull();
  });

  it("renames and deletes a shared section from its menu, opening each once the menu has closed (1.29)", async () => {
    const session = createEditorSession(siteLibrary, withHours());
    const panels = createPanelRegistry();
    const sharedActions = { rename: vi.fn(), remove: vi.fn() };
    registerAddPanel(panels, session, { sharedActions });
    render(<Host panels={panels} />);
    const user = userEvent.setup();

    await user.click(button("Actions for Opening hours"));
    await user.click(screen.getByRole("menuitem", { name: "Rename…" }));
    expect(sharedActions.rename).toHaveBeenCalledWith(HOURS);
    expect(screen.queryByRole("menu")).toBeNull();

    await user.click(button("Actions for Opening hours"));
    await user.click(screen.getByRole("menuitem", { name: "Delete…" }));
    expect(sharedActions.remove).toHaveBeenCalledWith(HOURS);
    // The library's sections have no such menu.
    expect(screen.queryByRole("button", { name: "Actions for Hero" })).toBeNull();
  });

  const preferencesWith = (favourites: string[] = [], recent: string[] = []) =>
    createPreferencesStore({
      preferences: { ...DEFAULT_PREFERENCES, add: { favourites, recent } },
    });
  const groups = () =>
    screen.getAllByRole("list").map((list) => list.getAttribute("aria-label") ?? "");

  it("leads with the person's favourites, added and removed from an item's context menu", async () => {
    const session = createEditorSession(siteLibrary, starterSite());
    const panels = createPanelRegistry();
    const preferences = preferencesWith(["Faq"]);
    // With previews, as in the app: the menu and the card share the item.
    registerAddPanel(panels, session, { preferences, preview: () => <span>Preview</span> });
    render(<Host panels={panels} />);
    expect(groups()[0]).toBe("Favourites");

    const hero = within(screen.getByRole("list", { name: "Heroes" })).getByRole("button", {
      name: "Hero",
    });
    fireEvent.contextMenu(hero);
    await userEvent.click(await screen.findByRole("menuitem", { name: "Add to Favourites" }));
    expect(preferences.getState().preferences.add.favourites).toEqual(["Faq", "Hero"]);
    expect(
      within(screen.getByRole("list", { name: "Favourites" }))
        .getAllByRole("button")
        .map((button) => button.textContent),
    ).toEqual(["FAQ", "Hero"]);

    fireEvent.contextMenu(hero);
    await userEvent.click(await screen.findByRole("menuitem", { name: "Remove from Favourites" }));
    expect(preferences.getState().preferences.add.favourites).toEqual(["Faq"]);
  });

  it("shows a section's preview while the pointer rests on it, through the canvas's drag handle", () => {
    vi.useFakeTimers();
    try {
      const session = createEditorSession(siteLibrary, starterSite());
      const panels = createPanelRegistry();
      registerAddPanel(panels, session, { preview: () => <span>Preview of it</span> });
      render(<Host panels={panels} />);
      const hero = within(screen.getByRole("list", { name: "Heroes" })).getByRole("button", {
        name: "Hero",
      });
      // Only the pointer's own events: React reports none for a button under Puck's handle.
      const pointer = (type: string) =>
        act(() => {
          hero.dispatchEvent(new PointerEvent(type, { pointerType: "mouse" }));
        });

      pointer("pointerenter");
      expect(screen.queryByText("Preview of it")).toBeNull();
      act(() => vi.advanceTimersByTime(400));
      expect(screen.getByText("Preview of it")).toBeTruthy();
      pointer("pointerdown");
      act(() => vi.advanceTimersByTime(0));
      expect(screen.queryByText("Preview of it")).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("remembers what the person adds as recently used, newest first", async () => {
    const session = createEditorSession(siteLibrary, starterSite());
    const panels = createPanelRegistry();
    const preferences = preferencesWith();
    registerAddPanel(panels, session, { preferences });
    render(<Host panels={panels} />);

    await userEvent.click(button("FAQ"));
    await userEvent.click(
      within(screen.getByRole("list", { name: "Heroes" })).getByRole("button", { name: "Hero" }),
    );

    expect(preferences.getState().preferences.add.recent).toEqual(["Hero", "Faq"]);
    expect(groups().slice(0, 1)).toEqual(["Recently used"]);
  });

  it("offers every item in the palette's Add group, adding where a click would, as one step", () => {
    const session = createEditorSession(siteLibrary, starterSite());
    const panels = createPanelRegistry();
    const registry = createCommandRegistry();
    const preferences = preferencesWith();
    const addPanel = registerAddPanel(panels, session, { commands: registry, preferences });
    const added = registry.list().filter((command) => command.palette === "add");
    expect(added.map((command) => command.label)).toContain("Add Hero");
    expect(added.map((command) => command.label)).toContain("Add Heading");

    expect(registry.run("add.item.Hero")).toBe(true);

    expect(currentPage(session)?.doc.content.map((node) => node.type)).toContain("Hero");
    expect(session.history.entries().map((entry) => entry.label)).toEqual(["Added Hero"]);
    expect(preferences.getState().preferences.add.recent).toEqual(["Hero"]);
    addPanel.remove();
    expect(registry.list().filter((command) => command.palette === "add")).toEqual([]);
  });

  it("names a shared section's Add in the palette by its name now", () => {
    const session = createEditorSession(siteLibrary, starterSite());
    const registry = createCommandRegistry();
    registerAddPanel(createPanelRegistry(), session, { commands: registry });
    session.select("section-1");
    saveAsSharedSection(session, "Welcome");
    const [id] = Object.keys(session.history.document.getState().sharedSections);

    expect(registry.get(`add.item.${id}`)?.label).toBe("Add a copy of 'Welcome'");
    session.edit("props", "Renamed", (draft) => {
      for (const shared of Object.values(draft.sharedSections)) shared.name = "Hello";
    });
    expect(registry.get(`add.item.${id}`)?.label).toBe("Add a copy of 'Hello'");
  });

  it("turns an Add off in the palette while nothing on the page takes it", () => {
    const site = starterSite();
    const home = site.pages[site.homePageId];
    if (home === undefined) throw new Error("no home page");
    home.doc.content = [];
    const session = createEditorSession(siteLibrary, site);
    const registry = createCommandRegistry();
    registerAddPanel(createPanelRegistry(), session, { commands: registry });

    expect(registry.get("add.item.Heading")?.enabled).toBe(false);
    act(() => void addComponent(session, "Section"));
    expect(registry.get("add.item.Heading")?.enabled).toBe(true);
  });
});
