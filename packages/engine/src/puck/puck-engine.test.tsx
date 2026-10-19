// @vitest-environment happy-dom
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CanvasEngine, EngineEdit, PageDoc } from "../canvas-engine.js";
import { type ComponentLibrary, textValue } from "../library.js";
import { createPuckEngine } from "./puck-engine.js";

declare global {
  // Tells React that act() is available (testing without @testing-library).
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const library: ComponentLibrary = {
  components: {
    Heading: {
      label: "Heading",
      fields: { text: { kind: "text", label: "Text", inline: true } },
      defaults: { text: "Heading" },
      render: ({ values }) => <p className="t-heading">{textValue(values.text)}</p>,
    },
  },
};

const page: PageDoc = {
  root: { props: {} },
  content: [
    { type: "Heading", props: { id: "a", text: "First" } },
    { type: "Heading", props: { id: "b", text: "Second" } },
  ],
};
const NO_LAYOUT = { header: [], footer: [] };

/** Lets Puck's effects and deferred dispatches run. */
async function settle(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
}

describe("createPuckEngine", () => {
  let element: HTMLDivElement;
  let engine: CanvasEngine;

  beforeEach(async () => {
    element = document.createElement("div");
    document.body.append(element);
    engine = createPuckEngine({ iframe: false });
    await act(async () => {
      engine.mount(element, { library, theme: { name: "test" } });
      engine.loadPage(page, NO_LAYOUT);
    });
    await settle();
  });

  afterEach(async () => {
    engine.destroy();
    await settle();
    element.remove();
  });

  const headings = () => [...element.querySelectorAll(".t-heading")].map((h) => h.textContent);

  it("shows the loaded page", () => {
    expect(headings()).toEqual(["First", "Second"]);
  });

  it("refuses to mount twice", () => {
    expect(() => engine.mount(element, { library, theme: { name: "test" } })).toThrow(/already/);
  });

  it("shows changes made outside the engine, without reporting them as edits", async () => {
    const edits = vi.fn();
    engine.onUserEdit(edits);

    await act(async () => {
      engine.applyChange({
        page: { ...page, content: [{ type: "Heading", props: { id: "b", text: "Only" } }] },
      });
    });
    await settle();

    expect(headings()).toEqual(["Only"]);
    expect(edits).not.toHaveBeenCalled();
  });

  it("ignores a change to the page it already shows", async () => {
    const before = element.innerHTML;

    await act(async () => engine.applyChange({ page: structuredClone(page) }));

    expect(element.innerHTML).toBe(before);
  });

  it("selects by id and keeps the element selected when it moves", async () => {
    const selections = vi.fn();
    engine.onSelectionChange(selections);

    await act(async () => engine.select("b"));
    await settle();
    await act(async () =>
      engine.applyChange({ page: { ...page, content: [...page.content].reverse() } }),
    );
    await settle();

    // Puck selects by position; the engine re-selects "b" at its new position silently.
    expect(selections).not.toHaveBeenCalled();
    expect(element.querySelector("[data-puck-component='b']")).not.toBeNull();
  });

  it("clears the selection when the selected element disappears", async () => {
    const selections = vi.fn();
    engine.onSelectionChange(selections);
    await act(async () => engine.select("a"));
    await settle();

    await act(async () =>
      engine.applyChange({ page: { ...page, content: page.content.slice(1) } }),
    );
    await settle();

    expect(selections).toHaveBeenCalledWith(null);
  });

  it("reports inline text edits as text edits", async () => {
    const edits: EngineEdit[] = [];
    engine.onUserEdit((edit) => edits.push(edit));
    const field = element.querySelector<HTMLElement>(".t-heading [data-puck-overlay-portal]");
    expect(field).not.toBeNull();

    await act(async () => {
      if (field === null) return;
      field.innerText = "Changed";
      field.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await settle();

    expect(edits).toHaveLength(1);
    expect(edits[0]).toMatchObject({ kind: "text", nodeId: "a", field: "text" });
    expect(edits[0]?.page.content[0]?.props.text).toBe("Changed");
  });

  it("takes back its own edit from the app without re-rendering it", async () => {
    engine.onUserEdit((edit) => engine.applyChange({ page: structuredClone(edit.page) }));
    const field = element.querySelector<HTMLElement>(".t-heading [data-puck-overlay-portal]");

    await act(async () => {
      if (field === null) return;
      field.innerText = "Typed";
      field.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await settle();

    expect(headings()).toEqual(["Typed", "Second"]);
  });

  it("clears the selection when another page is loaded", async () => {
    const selections = vi.fn();
    engine.onSelectionChange(selections);
    await act(async () => engine.select("a"));
    await settle();

    await act(async () => engine.loadPage(page, NO_LAYOUT));

    expect(selections).toHaveBeenCalledWith(null);
  });

  it("forwards history commands only from the canvas iframe", () => {
    const commands = vi.fn();
    const unsubscribe = engine.onHistoryCommand(commands);

    // Without an iframe the app's own window handler is in charge; the engine reports nothing.
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true }));
    unsubscribe();

    expect(commands).not.toHaveBeenCalled();
  });

  it("switches between design and content mode", async () => {
    await act(async () => engine.setMode("content"));
    await act(async () => engine.setMode("design"));

    expect(headings()).toEqual(["First", "Second"]);
  });

  it("changes the canvas width", async () => {
    await act(async () => {
      engine.setViewport("mobile");
      engine.setViewport(500);
    });

    expect(headings()).toEqual(["First", "Second"]);
  });

  it("renders a page to static HTML", () => {
    const html = engine.renderStatic(page, NO_LAYOUT);

    expect(html).toContain(">First</p>");
    expect(html).toContain(">Second</p>");
  });
});

describe("createPuckEngine before mount", () => {
  it("cannot render static HTML without a library", () => {
    expect(() => createPuckEngine().renderStatic(page, NO_LAYOUT)).toThrow(/Mount/);
  });

  it("accepts calls that need Puck before Puck is ready", () => {
    const engine = createPuckEngine();

    expect(() => {
      engine.loadPage(page, NO_LAYOUT);
      engine.applyChange({ page });
      engine.select("a");
      engine.setViewport("tablet");
      engine.setMode("content");
      engine.destroy();
    }).not.toThrow();
  });
});
