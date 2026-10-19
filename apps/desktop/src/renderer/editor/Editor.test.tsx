// @vitest-environment happy-dom
import { siteLibrary, starterPage } from "@webforge/site-components";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Editor } from "./Editor.js";
import { createEditorSession, type EditorSession } from "./editor-session.js";
import { createFakeEngine, type FakeEngine } from "./fake-engine.test-helper.js";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("Editor", () => {
  let container: HTMLDivElement;
  let root: Root;
  let session: EditorSession;
  let engine: FakeEngine;

  beforeEach(async () => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    session = createEditorSession(siteLibrary, starterPage());
    engine = createFakeEngine();
    const createEngine = () => engine;
    await act(async () => root.render(<Editor session={session} createEngine={createEngine} />));
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  const button = (name: string) =>
    [...container.querySelectorAll("button")].find(
      (b) => b.textContent === name,
    ) as HTMLButtonElement;

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

    expect(engine.mount).toHaveBeenCalledOnce();
    expect(canvas?.querySelector(".editor__canvas-root")).not.toBeNull();
    expect(engine.loadPage).toHaveBeenCalledWith(starterPage(), { header: [], footer: [] });
  });

  it("enables Undo and Redo as the history allows", async () => {
    expect(button("Undo").disabled).toBe(true);
    expect(button("Redo").disabled).toBe(true);

    await removeSection();
    expect(button("Undo").disabled).toBe(false);

    await act(async () => button("Undo").click());
    expect(session.history.state.getState().cursor).toBe(0);
    expect(button("Redo").disabled).toBe(false);

    await act(async () => button("Redo").click());
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
    root = createRoot(container);
  });
});
