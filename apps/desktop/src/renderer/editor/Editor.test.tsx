// @vitest-environment happy-dom
import { siteLibrary, starterPage } from "@webforge/site-components";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CommandRegistryProvider } from "../shell/command-context.js";
import { type CommandRegistry, createCommandRegistry } from "../shell/commands.js";
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

/** Renders the Undo History panel the editor registers, as the window layout would. */
function UndoHistoryHost() {
  const panel = usePanels().find((entry) => entry.id === "undoHistory");
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
            <UndoHistoryHost />
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

  it("mounts the engine in the canvas and loads the page", () => {
    const canvas = container.querySelector(".editor__canvas");

    const site = session.history.document.getState();
    expect(engine.mount).toHaveBeenCalledWith(expect.anything(), {
      library: siteLibrary,
      theme: site.theme,
    });
    expect(canvas?.querySelector(".editor__canvas-root")).not.toBeNull();
    expect(engine.loadPage).toHaveBeenCalledWith(starterPage(), site.layout);
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

  it("puts Undo History in the left column's bottom", () => {
    expect(panels.list()).toEqual([
      expect.objectContaining({ id: "undoHistory", slot: "left.bottom", title: "Undo History" }),
    ]);
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
