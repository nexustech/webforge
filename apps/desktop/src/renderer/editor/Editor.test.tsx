// @vitest-environment happy-dom
import { copiedNodeId, newSharedCopy, type SharedSectionId } from "@webforge/model";
import { siteLibrary, starterPage } from "@webforge/site-components";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { saveAsSharedSection } from "../shared-sections/shared-sections.js";
import { CommandRegistryProvider } from "../shell/command-context.js";
import { type CommandRegistry, createCommandRegistry } from "../shell/commands.js";
import { createSiteWideConfirm } from "../shell/confirm-site-wide.js";
import { PanelRegistryProvider, usePanels } from "../shell/panel-context.js";
import { createPanelRegistry, type PanelRegistry } from "../shell/panels.js";
import { Editor } from "./Editor.js";
import { createEditorSession, type EditorSession } from "./editor-session.js";
import { createFakeEngine, type FakeEngine } from "./fake-engine.test-helper.js";
import { starterSite } from "./starter-site.js";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const compileCss = vi.fn(async () => ({
  status: "compiled" as const,
  css: ".btn{}",
  bodyClass: "bg-base-100",
}));

/** Renders a panel the editor registers, as the window layout would. */
function PanelHost({ id }: { readonly id: string }) {
  const panel = usePanels().find((entry) => entry.id === id);
  return panel === undefined ? null : <panel.component />;
}

describe("Editor", () => {
  let container: HTMLDivElement;
  let root: Root;
  let session: EditorSession;
  let engine: FakeEngine;
  let registry: CommandRegistry;
  let panels: PanelRegistry;
  let createEngine: () => FakeEngine;

  beforeEach(async () => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    session = createEditorSession(siteLibrary, starterSite());
    engine = createFakeEngine();
    createEngine = () => engine;
    registry = createCommandRegistry();
    panels = createPanelRegistry();
    await act(async () =>
      root.render(
        <CommandRegistryProvider registry={registry}>
          <PanelRegistryProvider registry={panels}>
            <Editor session={session} createEngine={createEngine} compileCss={compileCss} />
            <PanelHost id="undoHistory" />
            <PanelHost id="add" />
          </PanelRegistryProvider>
        </CommandRegistryProvider>,
      ),
    );
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  const enabled = (id: string) => registry.get(id)?.enabled;

  const removeSection = () =>
    act(async () =>
      engine.edit({
        kind: "remove",
        componentType: "Section",
        page: { ...starterPage(), content: [] },
      }),
    );

  it("says how many copies a change reaches while an element of a copy is selected (F-ED-23)", async () => {
    const banner = () => container.querySelector('[role="status"]')?.textContent ?? null;
    await act(async () => {
      session.ui.setState({ nodeId: "section-1" });
      saveAsSharedSection(session, "Welcome");
    });
    const site = () => session.history.document.getState();
    const [shared] = Object.values(site().sharedSections);
    if (shared === undefined) throw new Error("not saved");
    const copyId = site().pages[site().homePageId]?.doc.content[0]?.props.id ?? "";
    await act(async () => session.ui.setState({ nodeId: copiedNodeId(copyId, "heading-1") }));
    expect(banner()).toBe("Editing shared section 'Welcome': changes apply to 1 copy on 1 page");

    const place = (onHome: boolean) =>
      act(async () =>
        session.edit("insert", "Added a copy", (draft) => {
          const page = Object.values(draft.pages).find(
            (entry) => (entry.id === draft.homePageId) === onHome,
          );
          page?.doc.content.push(
            newSharedCopy(page.doc.content, shared.id, draft.sharedSections, draft.layout),
          );
        }),
      );
    await place(true);
    expect(banner()).toBe("Editing shared section 'Welcome': changes apply to 2 copies on 1 page");
    await place(false);
    expect(banner()).toBe("Editing shared section 'Welcome': changes apply to 3 copies on 2 pages");
  });

  it("saves the selected section as a shared section under the name it asks for, and detaches", async () => {
    const save = "edit.saveSharedSection";
    const detach = "edit.detachSharedSection";
    expect(enabled(save)).toBe(false);
    await act(async () => session.ui.setState({ nodeId: "heading-1" }));
    expect(enabled(save)).toBe(false);
    await act(async () => session.ui.setState({ nodeId: "section-1" }));
    expect(enabled(save)).toBe(true);
    expect(enabled(detach)).toBe(false);

    await act(async () => registry.run(save));
    const input = document.querySelector<HTMLInputElement>('[role="dialog"] input');
    expect(input?.value).toBe("Section");
    const form = input?.closest("form");
    await act(async () => {
      if (input === null || input === undefined) return;
      const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setValue?.call(input, "Opening hours");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => form?.requestSubmit());

    const site = session.history.document.getState();
    expect(Object.values(site.sharedSections).map((shared) => shared.name)).toEqual([
      "Opening hours",
    ]);
    expect(enabled(save)).toBe(false);
    expect(enabled(detach)).toBe(true);

    await act(async () => registry.run(detach));
    expect(enabled(detach)).toBe(false);
    expect(session.history.entries().at(-1)?.label).toBe("Detached 'Opening hours'");
  });

  it("renames a shared section, refusing a name in use, and deletes it after asking (D7)", async () => {
    const siteWide = createSiteWideConfirm();
    await act(async () =>
      root.render(
        <CommandRegistryProvider registry={registry}>
          <PanelRegistryProvider registry={panels}>
            <Editor
              session={session}
              createEngine={createEngine}
              compileCss={compileCss}
              siteWide={siteWide}
            />
          </PanelRegistryProvider>
        </CommandRegistryProvider>,
      ),
    );
    await act(async () => {
      session.ui.setState({ nodeId: "section-1" });
      saveAsSharedSection(session, "Welcome");
    });
    await act(async () =>
      session.edit("props", "Added a shared section", (draft) => {
        const [welcome] = Object.values(draft.sharedSections);
        const other = "shared-team" as SharedSectionId;
        if (welcome !== undefined)
          draft.sharedSections[other] = { ...welcome, id: other, name: "Team" };
      }),
    );
    expect(enabled("edit.renameSharedSection")).toBe(true);
    expect(enabled("edit.deleteSharedSection")).toBe(true);

    await act(async () => registry.run("edit.renameSharedSection"));
    const input = document.querySelector<HTMLInputElement>('[role="dialog"] input');
    expect(input?.value).toBe("Welcome");
    const type = (value: string) =>
      act(async () => {
        if (input === null) return;
        const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
        setValue?.call(input, value);
        input.dispatchEvent(new Event("input", { bubbles: true }));
      });
    const confirm = () =>
      document.querySelector<HTMLButtonElement>('[role="dialog"] button[type="submit"]');
    await type(" TEAM ");
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain(
      "A shared section called 'Team' already exists",
    );
    expect(confirm()?.disabled).toBe(true);
    await type("Opening hours");
    expect(confirm()?.disabled).toBe(false);
    await act(async () => confirm()?.click());
    expect(session.history.entries().at(-1)?.label).toBe("Renamed 'Welcome' to 'Opening hours'");

    await act(async () => registry.run("edit.deleteSharedSection"));
    expect(siteWide.current()).toMatchObject({
      action: "Delete shared section 'Opening hours'?",
      affectedPages: 1,
    });
    await act(async () => siteWide.answer(true));
    const site = session.history.document.getState();
    expect(Object.values(site.sharedSections).map((shared) => shared.name)).toEqual(["Team"]);
    expect(session.history.entries().at(-1)?.label).toBe("Deleted shared section 'Opening hours'");
    expect(enabled("edit.deleteSharedSection")).toBe(false);
  });

  it("turns the shared-section commands off in Content mode (M3)", async () => {
    await act(async () =>
      root.render(
        <CommandRegistryProvider registry={registry}>
          <PanelRegistryProvider registry={panels}>
            <Editor
              session={session}
              createEngine={createEngine}
              compileCss={compileCss}
              mode="content"
            />
          </PanelRegistryProvider>
        </CommandRegistryProvider>,
      ),
    );
    await act(async () => session.ui.setState({ nodeId: "section-1" }));

    expect(enabled("edit.saveSharedSection")).toBe(false);
    // Nor anything else that changes shared sections; edits in a copy's content still work.
    await act(async () => {
      saveAsSharedSection(session, "Welcome");
    });
    for (const id of ["rename", "detach", "delete"]) {
      expect(enabled(`edit.${id}SharedSection`)).toBe(false);
    }
  });

  it("says how many pages a change reaches while a shared element is selected (F-ED-7)", async () => {
    const banner = () => container.querySelector('[role="status"]')?.textContent ?? null;
    const pages = Object.keys(session.history.document.getState().pages).length;
    expect(banner()).toBeNull();

    await act(async () => session.ui.setState({ nodeId: "footer" }));
    expect(banner()).toBe(`Editing shared Footer: changes apply to all ${pages} pages`);

    // Hidden on the page shown: not on the canvas, so nothing selected there to edit.
    await act(async () =>
      session.edit("props", "Changed page settings", (draft) => {
        const home = draft.pages[draft.homePageId];
        if (home !== undefined) home.settings.hideFooter = true;
      }),
    );
    expect(banner()).toBeNull();

    await act(async () => session.ui.setState({ nodeId: "header" }));
    expect(banner()).toBe(`Editing shared Header: changes apply to all ${pages} pages`);
    const notFound = Object.values(session.history.document.getState().pages).find(
      (page) => page.kind === "not-found",
    );
    await act(
      async () => notFound && session.ui.setState({ pageId: notFound.id, nodeId: "footer" }),
    );
    // The new site's two pages: Home hides the Footer, so only this one shows it.
    expect(pages).toBe(2);
    expect(banner()).toBe("Editing shared Footer: changes apply to 1 page");

    await act(async () => session.ui.setState({ nodeId: "heading-1" }));
    expect(banner()).toBeNull();
  });

  it("lists Undo and Redo first in the Edit menu, then the canvas's actions", () => {
    const edit = registry
      .list()
      .filter((command) => command.menu === "edit")
      .map((command) => command.id);

    expect(edit.slice(0, 2)).toEqual(["edit.undo", "edit.redo"]);
    expect(edit).toContain("edit.delete");
  });

  it("enables the canvas's edits only while an element is selected", async () => {
    expect(enabled("edit.delete")).toBe(false);

    await act(async () => engine.selectFromCanvas("heading-1"));

    expect(enabled("edit.delete")).toBe(true);
  });

  it("runs the canvas's shortcuts pressed inside the canvas iframe", async () => {
    const frame = document.createElement("iframe");
    document.body.append(frame);
    const frameWindow = frame.contentWindow;
    if (frameWindow === null) throw new Error("no iframe window");
    await act(async () => engine.showFrame(frameWindow));

    frameWindow.document.body.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "ArrowDown",
        bubbles: true,
        cancelable: true,
      }),
    );
    await act(async () => engine.showFrame(null));
    frameWindow.document.body.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true, cancelable: true }),
    );

    expect(engine.perform).toHaveBeenCalledExactlyOnceWith("selectNext");
    frame.remove();
  });

  it("opens the Add panel where the floating + asks, and adds the section chosen there", async () => {
    const shown = vi.fn();
    panels.onShow(shown);

    await act(async () => engine.requestAdd({ index: 0 }));
    const hero = [...container.querySelectorAll("button")].find((b) => b.textContent === "Hero");
    await act(async () => hero?.click());

    expect(shown).toHaveBeenCalledWith("add");
    expect(session.history.entries().map((entry) => entry.label)).toEqual(["Added Hero"]);
    expect(
      session.history.document.getState().pages[session.ui.getState().pageId]?.doc.content[0]?.type,
    ).toBe("Hero");
  });

  it("lets the Add panel's items be dragged onto the canvas", () => {
    expect(engine.addDragSource).toHaveBeenCalledWith(expect.any(HTMLButtonElement), "Hero");
  });

  it("hides the Add panel in Content mode", async () => {
    expect(panels.list().map((panel) => panel.id)).toContain("add");

    await act(async () =>
      root.render(
        <CommandRegistryProvider registry={registry}>
          <PanelRegistryProvider registry={panels}>
            <Editor
              session={session}
              createEngine={createEngine}
              compileCss={compileCss}
              mode="content"
            />
          </PanelRegistryProvider>
        </CommandRegistryProvider>,
      ),
    );

    expect(panels.list().map((panel) => panel.id)).not.toContain("add");
  });

  it("mounts the engine in the canvas and loads the page", () => {
    const canvas = container.querySelector(".editor__canvas");

    const site = session.history.document.getState();
    expect(engine.mount).toHaveBeenCalledWith(expect.anything(), {
      library: siteLibrary,
      theme: site.theme,
    });
    expect(canvas?.querySelector(".editor__canvas-root")).not.toBeNull();
    expect(engine.loadPage).toHaveBeenCalledWith(starterPage(), site.layout, site.sharedSections);
  });

  it("mounts the engine already in Content mode when the site opens in it", async () => {
    await act(async () => root.unmount());
    root = createRoot(container);
    const content = createFakeEngine();
    const order: string[] = [];
    vi.mocked(content.mount).mockImplementation(() => {
      order.push("mount");
    });
    vi.mocked(content.setMode).mockImplementation((mode) => {
      order.push(`setMode ${mode}`);
    });
    vi.mocked(content.loadPage).mockImplementation(() => {
      order.push("loadPage");
    });

    await act(async () =>
      root.render(
        <CommandRegistryProvider registry={createCommandRegistry()}>
          <PanelRegistryProvider registry={createPanelRegistry()}>
            <Editor
              session={session}
              createEngine={() => content}
              compileCss={compileCss}
              mode="content"
            />
          </PanelRegistryProvider>
        </CommandRegistryProvider>,
      ),
    );

    expect(order.slice(0, 3)).toEqual(["mount", "setMode content", "loadPage"]);
  });

  it("passes Design or Content mode to the engine, without remounting it", async () => {
    expect(engine.setMode).toHaveBeenLastCalledWith("design");

    await act(async () =>
      root.render(
        <CommandRegistryProvider registry={registry}>
          <PanelRegistryProvider registry={panels}>
            <Editor
              session={session}
              createEngine={createEngine}
              compileCss={compileCss}
              mode="content"
            />
          </PanelRegistryProvider>
        </CommandRegistryProvider>,
      ),
    );

    expect(engine.setMode).toHaveBeenLastCalledWith("content");
    expect(engine.mount).toHaveBeenCalledOnce();
  });

  it("passes the View menu's options to the engine, without remounting it (F-ED-25)", async () => {
    expect(engine.setViewOptions).not.toHaveBeenCalled();
    const options = {
      outlines: true,
      spacingOnHover: false,
      elementNames: true,
      extraBottomSpace: false,
    };

    await act(async () =>
      root.render(
        <CommandRegistryProvider registry={registry}>
          <PanelRegistryProvider registry={panels}>
            <Editor
              session={session}
              createEngine={createEngine}
              compileCss={compileCss}
              viewOptions={options}
            />
          </PanelRegistryProvider>
        </CommandRegistryProvider>,
      ),
    );

    expect(engine.setViewOptions).toHaveBeenLastCalledWith(options);
    expect(engine.mount).toHaveBeenCalledOnce();
  });

  it("styles the canvas with the site's compiled CSS", () => {
    expect(compileCss).toHaveBeenCalledWith(
      expect.objectContaining({ theme: session.history.document.getState().theme }),
    );
    expect(engine.setSiteCss).toHaveBeenCalledWith(".btn{}", "bg-base-100");
  });

  it("offers Undo and Redo as commands, enabled as the history allows", async () => {
    expect(registry.get("edit.undo")).toMatchObject({ label: "Undo", menu: "edit" });
    expect(enabled("edit.undo")).toBe(false);
    expect(enabled("edit.redo")).toBe(false);

    await removeSection();
    expect(enabled("edit.undo")).toBe(true);

    await act(async () => registry.run("edit.undo"));
    expect(session.history.state.getState().cursor).toBe(0);
    expect(enabled("edit.redo")).toBe(true);

    await act(async () => registry.run("edit.redo"));
    expect(session.history.state.getState().cursor).toBe(1);
  });

  it("undoes with Ctrl+Z anywhere in the window (U4)", async () => {
    await removeSection();

    await act(async () => {
      document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true }));
    });

    expect(session.history.state.getState().cursor).toBe(0);
  });

  it("jumps to a step clicked in Undo History", async () => {
    await removeSection();
    const opened = [...container.querySelectorAll<HTMLButtonElement>(".undo-history__step")].at(-1);

    await act(async () => opened?.click());

    expect(session.history.state.getState().cursor).toBe(0);
  });

  it("puts Add and Undo History on the left, and the Edit panel and Media on the right", () => {
    // In any order: Add is registered again once the canvas engine is there.
    expect(panels.list()).toHaveLength(4);
    expect(panels.list()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "undoHistory", slot: "left.bottom", title: "Undo History" }),
        expect.objectContaining({ id: "edit", slot: "right.top", title: "Edit" }),
        expect.objectContaining({ id: "add", slot: "left.top", title: "Add" }),
        expect.objectContaining({ id: "media", slot: "right.bottom", title: "Media" }),
      ]),
    );
  });

  it("redraws only the Edit panel when the editor level changes, keeping the other tabs in place", async () => {
    await act(async () =>
      root.render(
        <CommandRegistryProvider registry={registry}>
          <PanelRegistryProvider registry={panels}>
            <Editor
              session={session}
              createEngine={createEngine}
              compileCss={compileCss}
              editorLevel="advanced"
            />
          </PanelRegistryProvider>
        </CommandRegistryProvider>,
      ),
    );

    // Undo History isn't registered again, so it keeps its place among its slot's tabs.
    expect(panels.list()[0]).toEqual(expect.objectContaining({ id: "undoHistory" }));
    expect(panels.list().map((panel) => panel.id)).toContain("edit");
  });

  it("lists the steps in Undo History", async () => {
    await removeSection();

    const steps = [...container.querySelectorAll(".undo-history__step")].map((s) => s.textContent);
    expect(steps).toEqual(["Deleted Section", "Opened page"]);
  });

  it("destroys the engine and stops listening to keys when unmounted", async () => {
    await removeSection();
    await act(async () => root.unmount());

    document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true }));

    expect(engine.destroy).toHaveBeenCalledOnce();
    expect(session.history.state.getState().cursor).toBe(1);
    expect(registry.get("edit.undo")).toBeUndefined();
    expect(panels.list()).toEqual([]);
    root = createRoot(container);
  });
});
