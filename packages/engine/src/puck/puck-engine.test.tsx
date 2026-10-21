// @vitest-environment happy-dom

import type { PageDoc } from "@webforge/model";
import { type ComponentLibrary, textValue } from "@webforge/site-components";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CanvasEngine, EngineEdit } from "../canvas-engine.js";
import { pageActions } from "./page-actions.js";
import { createPuckEngine } from "./puck-engine.js";

vi.mock("./page-actions.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./page-actions.js")>();
  return { ...actual, pageActions: vi.fn(actual.pageActions) };
});

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

    await act(async () => engine.applyChange({ page }));

    expect(element.innerHTML).toBe(before);
  });

  it("sends Puck nothing for a page with the same content", async () => {
    vi.mocked(pageActions).mockClear();

    await act(async () => engine.applyChange({ page: structuredClone(page) }));
    await settle();

    // Translated into no actions at all, rather than a whole-page setData.
    expect(vi.mocked(pageActions).mock.results).toEqual([{ type: "return", value: [] }]);
    expect(headings()).toEqual(["First", "Second"]);
  });

  it("sends an undo step to Puck as the changed element only", async () => {
    const [first, second] = page.content;
    if (first === undefined || second === undefined) throw new Error("unexpected page");
    vi.mocked(pageActions).mockClear();

    await act(async () =>
      engine.applyChange({
        page: {
          ...page,
          content: [{ ...first, props: { ...first.props, text: "Undone" } }, second],
        },
      }),
    );
    await settle();

    expect(headings()).toEqual(["Undone", "Second"]);
    expect(vi.mocked(pageActions).mock.results).toEqual([
      {
        type: "return",
        value: [expect.objectContaining({ type: "replace", destinationIndex: 0 })],
      },
    ]);
  });

  it("shows a page given before Puck was ready once it is", async () => {
    const late = createPuckEngine({ iframe: false });
    const host = document.createElement("div");
    document.body.append(host);
    const other: PageDoc = {
      root: { props: {} },
      content: [{ type: "Heading", props: { id: "z", text: "Later" } }],
    };

    await act(async () => {
      late.mount(host, { library, theme: { name: "test" } });
      late.applyChange({ page: other });
    });
    await settle();

    expect(host.querySelector(".t-heading")?.textContent).toBe("Later");
    late.destroy();
    await settle();
    host.remove();
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
    expect(edits[0]).toMatchObject({
      kind: "text",
      nodeId: "a",
      field: "text",
      patch: { nodeId: "a", field: "text", value: "Changed" },
    });
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

  describe("selection chrome (1.12)", () => {
    const action = (title: string) =>
      element.querySelector<HTMLButtonElement>(`[title="${title}"]`);
    const selectA = async () => {
      await act(async () => engine.select("a"));
      await settle();
    };

    it("outlines the selected element", async () => {
      await selectA();

      expect(element.querySelectorAll('.wf-outline[data-state="selected"]')).toHaveLength(1);
      expect(document.head.querySelector("style[data-webforge-chrome]")).toBeNull();
    });

    it("moves the selected element with Move down, as one move that keeps it selected", async () => {
      const edits: EngineEdit[] = [];
      engine.onUserEdit((edit) => edits.push(edit));
      await selectA();
      expect(action("Move up")?.disabled).toBe(true);

      await act(async () => action("Move down")?.click());
      await settle();

      expect(edits).toHaveLength(1);
      expect(edits[0]).toMatchObject({ kind: "move", nodeId: "a", selection: "a" });
      expect(headings()).toEqual(["Second", "First"]);
      expect(action("Move down")?.disabled).toBe(true);
    });

    it("duplicates and deletes with Puck's own actions, one edit each", async () => {
      const kinds: string[] = [];
      engine.onUserEdit((edit) => kinds.push(edit.kind));
      await selectA();

      await act(async () => action("Duplicate")?.click());
      await settle();
      await act(async () => action("Delete")?.click());
      await settle();

      expect(kinds).toEqual(["duplicate", "remove"]);
    });

    it("does keyboard actions on the selected element, one edit each", async () => {
      const edits: EngineEdit[] = [];
      engine.onUserEdit((edit) => edits.push(edit));
      const selections: (string | null)[] = [];
      engine.onSelectionChange((id) => selections.push(id));

      await act(async () => {
        expect(engine.perform("selectNext")).toBe(true);
      });
      await settle();
      expect(selections.at(-1)).toBe("a");
      expect(engine.perform("moveUp")).toBe(false);

      await act(async () => {
        expect(engine.perform("moveDown")).toBe(true);
      });
      await settle();
      expect(headings()).toEqual(["Second", "First"]);
      await act(async () => {
        expect(engine.perform("selectPrevious")).toBe(true);
      });
      await settle();
      expect(selections.at(-1)).toBe("b");
      await act(async () => {
        expect(engine.perform("duplicate")).toBe(true);
      });
      await settle();
      await act(async () => {
        expect(engine.perform("delete")).toBe(true);
      });
      await settle();

      expect(edits.map((edit) => edit.kind)).toEqual(["move", "duplicate", "remove"]);
      expect(headings()).toEqual(["Second", "First"]);
    });

    it("adds a section after a top-level element with the floating +", async () => {
      const requests: unknown[] = [];
      engine.onAddRequest((at) => requests.push(at));
      await selectA();

      await act(async () => element.querySelector<HTMLButtonElement>(".wf-add")?.click());

      expect(requests).toEqual([{ index: 1 }]);
    });

    it("offers no move in Content mode, where the layout is locked", async () => {
      await act(async () => engine.setMode("content"));
      await selectA();

      expect(action("Move down")).toBeNull();
      expect(action("Duplicate")).toBeNull();
      expect(element.querySelector(".wf-add")).toBeNull();
      expect(engine.perform("moveDown")).toBe(false);
      expect(engine.perform("duplicate")).toBe(false);
      expect(engine.perform("delete")).toBe(false);
    });
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

  it("leaves the device view to the app: no buttons of Puck's own, nothing reported back", async () => {
    // Puck shows its device buttons only around an iframe canvas; the canvas toolbar replaces them.
    const framed = createPuckEngine();
    const host = document.createElement("div");
    document.body.append(host);
    await act(async () => framed.mount(host, { library, theme: { name: "test" } }));
    await settle();
    const views: unknown[] = [];
    framed.onViewportChange((viewport) => views.push(viewport));

    await act(async () => framed.setViewport("tablet"));
    await act(async () => framed.setMode("content"));
    await settle();

    expect(host.querySelector('button[title="Show the Mobile view"]')).toBeNull();
    expect(views).toEqual([]);
    framed.destroy();
    await settle();
    host.remove();
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
      expect(engine.perform("delete")).toBe(false);
      engine.destroy();
    }).not.toThrow();
  });
});
