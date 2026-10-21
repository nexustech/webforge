// @vitest-environment happy-dom

import type { PageDoc } from "@webforge/model";
import { type ComponentLibrary, textValue } from "@webforge/site-components";
import { act } from "react";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CanvasEngine, CanvasSize, EngineEdit } from "../canvas-engine.js";
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

// Puck's canvas starts a 500 ms timer when it mounts (to show its loader). One left from the last
// test would fire after the test environment is gone, where React finds no `window`.
afterAll(async () => {
  await new Promise((resolve) => setTimeout(resolve, 600));
});

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

  it("reports a device view chosen with the canvas's own buttons, not one the app set", async () => {
    // Puck shows its device buttons only around an iframe canvas, and only when asked to.
    const framed = createPuckEngine({ canvasControls: true });
    const host = document.createElement("div");
    document.body.append(host);
    await act(async () => framed.mount(host, { library, theme: { name: "test" } }));
    await settle();
    const views: unknown[] = [];
    framed.onViewportChange((viewport) => views.push(viewport));
    const button = (label: string) =>
      host.querySelector<HTMLButtonElement>(`button[title="Show the ${label} view"]`);
    expect(button("Mobile")).not.toBeNull();

    await act(async () => framed.setViewport("tablet"));
    await settle();
    expect(button("Tablet")?.disabled).toBe(true);
    await act(async () => button("Mobile")?.click());
    await settle();

    // Re-rendering Puck (another mode) keeps the view rather than picking one for the window.
    await act(async () => framed.setMode("content"));
    await settle();

    expect(views).toEqual(["mobile"]);
    expect(button("Mobile")?.disabled).toBe(true);
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

describe("createPuckEngine canvas size and zoom (1.15)", () => {
  let host: HTMLDivElement;
  let framed: CanvasEngine;

  beforeEach(async () => {
    // happy-dom has no layout: give every element a 640 × 480 box, so Puck fits the 1280 px
    // Desktop view at 0.5 and leaves the 375 px Mobile view at 1.
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue(
      DOMRect.fromRect({ width: 640, height: 480 }),
    );
    framed = createPuckEngine();
    host = document.createElement("div");
    document.body.append(host);
    await act(async () => framed.mount(host, { library, theme: { name: "test" } }));
    await settle();
  });

  afterEach(async () => {
    framed.destroy();
    await settle();
    host.remove();
    vi.restoreAllMocks();
  });

  const run = async (change: () => void) => {
    await act(async () => change());
    await settle();
  };

  it("hides Puck's own device and zoom buttons unless asked for them", () => {
    expect(host.querySelector('button[title="Show the Mobile view"]')).toBeNull();
    expect(host.querySelector('button[title="Zoom in"]')).toBeNull();
  });

  it("starts fitted and reports the size and zoom at once", () => {
    const sizes: CanvasSize[] = [];
    framed.onCanvasSize((size) => sizes.push(size));

    expect(sizes).toEqual([{ width: 1280, height: 960, zoom: 0.5 }]);
  });

  it("zooms as asked, fits again on a view change or when asked, reporting each change", async () => {
    const sizes: CanvasSize[] = [];
    framed.onCanvasSize((size) => sizes.push(size));

    await run(() => framed.setZoom(0.25));
    await run(() => framed.setViewport("mobile"));
    await run(() => framed.setZoom(2));
    await run(() => framed.setZoom("fit"));

    // One report per change, with the height that goes with the zoom: the 480 px in view.
    expect(sizes.map(({ width, height, zoom }) => [width, height, zoom])).toEqual([
      [1280, 960, 0.5],
      [1280, 1920, 0.25],
      [375, 480, 1],
      [375, 240, 2],
      [375, 480, 1],
    ]);
  });

  it("ignores zooms that aren't one, and reports nothing that didn't change", async () => {
    const sizes: CanvasSize[] = [];
    framed.onCanvasSize((size) => sizes.push(size));

    await run(() => framed.setZoom(0));
    await run(() => framed.setZoom(Number.NaN));
    await run(() => framed.setZoom(0.5));

    expect(sizes).toHaveLength(1);
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
      engine.setZoom(0.5);
      engine.setMode("content");
      expect(engine.perform("delete")).toBe(false);
      engine.destroy();
    }).not.toThrow();
  });
});
