// @vitest-environment happy-dom

import {
  copiedNodeId,
  DEFAULT_THEME,
  type PageDoc,
  SHARED_COPY_TYPE,
  type SharedSectionId,
  type SharedSectionsDoc,
} from "@webforge/model";
import { boundText, type ComponentLibrary, textValue } from "@webforge/site-components";
import { act, Component, type ReactNode } from "react";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CanvasEngine, CanvasSize, EngineEdit, Unsubscribe } from "../canvas-engine.js";
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
    Bound: {
      label: "Bound",
      fields: {
        text: { kind: "text", label: "Text", inline: true, bindable: ["contact.phone"] },
      },
      defaults: { text: "Bound" },
      render: ({ values, context }) => (
        <p className="t-heading">{boundText(values, "text", context)}</p>
      ),
    },
    Nav: {
      label: "Nav",
      fields: {},
      defaults: {},
      render: ({ context }) => (
        <ul className="t-nav">
          {context.navigation.map((item) => (
            <li key={item.label}>{item.label}</li>
          ))}
        </ul>
      ),
    },
    Hours: {
      label: "Hours",
      fields: {},
      defaults: {},
      render: ({ context }) => (
        <ul className="t-hours">
          {(context.openingHours ?? []).map((hours) => (
            <li key={hours.opens}>{`${hours.days.join(" ")} ${hours.opens}`}</li>
          ))}
        </ul>
      ),
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
      engine.mount(element, { library, theme: { ...DEFAULT_THEME, preset: "test" } });
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
    expect(() =>
      engine.mount(element, { library, theme: { ...DEFAULT_THEME, preset: "test" } }),
    ).toThrow(/already/);
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
      late.mount(host, { library, theme: { ...DEFAULT_THEME, preset: "test" } });
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

    expect(selections).toHaveBeenCalledWith(null, false);
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

    it("moves the actions to the bar of the element selected next", async () => {
      await selectA();
      await act(async () => engine.select("b"));
      await settle();

      // The second of two: it can move up, not down. A bar that kept what it found for the first
      // selection would still say otherwise (R2).
      expect(element.querySelectorAll('[title="Move up"]')).toHaveLength(1);
      expect(action("Move up")?.disabled).toBe(false);
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

    it("unlocks the layout again back in Design mode (1.26)", async () => {
      await act(async () => engine.setMode("content"));
      await act(async () => engine.setMode("design"));
      await settle();
      await selectA();

      expect(action("Duplicate")).not.toBeNull();
      expect(engine.perform("moveDown")).toBe(true);
    });
  });

  it("clears the selection when another page is loaded", async () => {
    const selections = vi.fn();
    engine.onSelectionChange(selections);
    await act(async () => engine.select("a"));
    await settle();

    await act(async () => engine.loadPage(page, NO_LAYOUT));

    expect(selections).toHaveBeenCalledWith(null, false);
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
    await act(async () =>
      framed.mount(host, { library, theme: { ...DEFAULT_THEME, preset: "test" } }),
    );
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

  it("marks a hidden element for dimming, keeping it selectable (F-ED-12)", async () => {
    const [first, second] = page.content;
    if (first === undefined || second === undefined) throw new Error("unexpected page");
    await act(async () =>
      engine.applyChange({
        page: { ...page, content: [{ ...first, props: { ...first.props, hidden: true } }, second] },
      }),
    );
    await settle();

    const marked = [...element.querySelectorAll(".t-heading")].map((heading) =>
      heading.hasAttribute("data-webforge-hidden"),
    );
    expect(marked).toEqual([true, false]);

    await act(async () => engine.select("a"));
    await settle();
    expect(element.querySelectorAll('.wf-outline[data-state="selected"]')).toHaveLength(1);
  });

  it("shows a bound element's Site Settings value, or the hint, as they change (1.17)", async () => {
    const bound = (bindings?: Record<string, string>): PageDoc => ({
      ...page,
      content: [{ type: "Bound", props: { id: "b", text: "Own", ...(bindings && { bindings }) } }],
    });
    await act(async () => {
      engine.setSettings({ setting: () => undefined, emptySetting: (key) => `Add ${key}` });
      engine.applyChange({ page: bound() });
    });
    await settle();
    expect(headings()).toEqual(["Own"]);

    // Binding it is a change of its props only, which Puck must not take for the inline text.
    await act(async () => engine.applyChange({ page: bound({ text: "contact.phone" }) }));
    await settle();
    expect(headings()).toEqual(["Add contact.phone"]);

    await act(async () =>
      engine.setSettings({ setting: (key) => (key === "contact.phone" ? "0123" : undefined) }),
    );
    await settle();
    expect(headings()).toEqual(["0123"]);
  });

  it("shows the site's opening hours, drawing the page again when they change (2.8)", async () => {
    const hours = () =>
      [...element.querySelectorAll(".t-hours li")].map((item) => item.textContent);
    await act(async () =>
      engine.applyChange({ page: { ...page, content: [{ type: "Hours", props: { id: "h" } }] } }),
    );
    await settle();
    expect(hours()).toEqual([]);

    await act(async () =>
      engine.setSettings({
        setting: () => undefined,
        openingHours: [{ days: ["sat", "sun"], opens: "08:00", closes: "13:00" }],
      }),
    );
    await settle();
    expect(hours()).toEqual(["sat sun 08:00"]);

    // Settings without hours leave none from before.
    await act(async () => engine.setSettings({ setting: () => undefined }));
    await settle();
    expect(hours()).toEqual([]);
  });

  it("shows the site's navigation, drawing the page again when it changes (1.21)", async () => {
    const nav = () => [...element.querySelectorAll(".t-nav li")].map((item) => item.textContent);
    await act(async () =>
      engine.applyChange({ page: { ...page, content: [{ type: "Nav", props: { id: "n" } }] } }),
    );
    await settle();
    expect(nav()).toEqual([]);

    await act(async () =>
      engine.setNavigation([
        { label: "Home", href: "#", current: true },
        { label: "More", current: false, children: [{ label: "Blog", href: "#", current: false }] },
      ]),
    );
    await settle();

    expect(nav()).toEqual(["Home", "More"]);
  });

  it("makes an element outside the canvas a drag source for a new element, until removed (1.13)", async () => {
    const item = document.createElement("button");
    item.style.position = "relative";
    document.body.append(item);
    const clicks = vi.fn();
    item.addEventListener("click", clicks);

    let remove: Unsubscribe = () => undefined;
    await act(async () => {
      remove = engine.addDragSource(item, "Heading");
    });
    const handle = item.querySelector<HTMLElement>(".wf-drag-source [data-puck-drawer-item]");
    expect(handle).not.toBeNull();
    // The name shows only on the chip that follows the pointer while dragging.
    expect(item.querySelector(".wf-drag-source__label")?.textContent).toBe("Heading");
    handle?.click();
    expect(clicks).toHaveBeenCalledTimes(1);
    // Not a second tab stop or a button inside the app's button (#158): the item keeps the keys.
    for (const drawerItem of item.querySelectorAll("[data-puck-drawer-item]")) {
      expect(drawerItem.getAttribute("tabindex")).toBe("-1");
      expect(drawerItem.getAttribute("aria-hidden")).toBe("true");
      expect(drawerItem.getAttribute("role")).toBe("presentation");
    }
    // One copy of the styles, in the app's document.
    expect(document.querySelectorAll("style[data-webforge-drag-sources]")).toHaveLength(1);

    await act(async () => remove());
    expect(item.querySelector(".wf-drag-source")).toBeNull();
    item.remove();
  });
});

describe("createPuckEngine canvas size and zoom (1.15)", () => {
  let host: HTMLDivElement;
  let framed: CanvasEngine;
  /**
   * `offsetWidth` of Puck's scroll container (the canvas's own box, scrollbars included), and of
   * the frame inside it, which a scrollbar makes narrower.
   */
  let canvasWidth = 640;
  let frameWidth = 640;
  /** What Puck's ResizeObservers would hear; happy-dom has no layout to resize. */
  const resizeCallbacks: (() => void)[] = [];
  const resize = () => {
    for (const callback of resizeCallbacks) callback();
  };

  beforeEach(async () => {
    // happy-dom has no layout: give every element a 640 × 480 box, so Puck fits the 1280 px
    // Desktop view at 0.5 and leaves the 375 px Mobile view at 1.
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue(
      DOMRect.fromRect({ width: 640, height: 480 }),
    );
    canvasWidth = 640;
    frameWidth = 640;
    vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockImplementation(function (
      this: HTMLElement,
    ) {
      return this.className.includes("PuckCanvas-inner") ? frameWidth : canvasWidth;
    });
    resizeCallbacks.length = 0;
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(callback: () => void) {
          resizeCallbacks.push(callback);
        }
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    framed = createPuckEngine();
    host = document.createElement("div");
    document.body.append(host);
    await act(async () =>
      framed.mount(host, { library, theme: { ...DEFAULT_THEME, preset: "test" } }),
    );
    await settle();
  });

  afterEach(async () => {
    framed.destroy();
    await settle();
    host.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  const run = async (change: () => void) => {
    await act(async () => change());
    await settle();
  };

  it("keeps a zoom above Fit when its scrollbar resizes the canvas, fitting again on a real resize (#134)", async () => {
    const zooms: number[] = [];
    framed.onCanvasSize((size) => zooms.push(size.zoom));
    // A ResizeObserver reports once when it starts observing.
    await run(resize);

    await run(() => framed.setZoom(1));
    // The page now overflows: the canvas's scrollbar takes room from the frame inside it, but the
    // canvas itself keeps its size.
    frameWidth = 625;
    await run(resize);
    expect(zooms.at(-1)).toBe(1);

    // The window or a column changes the canvas's size: it fits again.
    await run(() => framed.setZoom(1));
    canvasWidth = 900;
    frameWidth = 900;
    await run(resize);
    expect(zooms).toEqual([0.5, 1, 0.5]);
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

describe("createPuckEngine with a shared Header and Footer (F-ED-7)", () => {
  let element: HTMLDivElement;
  let engine: CanvasEngine;
  const layout = {
    header: [{ type: "Heading", props: { id: "h", text: "Shop" } }],
    footer: [{ type: "Heading", props: { id: "f", text: "Thanks" } }],
  };

  beforeEach(async () => {
    element = document.createElement("div");
    document.body.append(element);
    engine = createPuckEngine({ iframe: false });
    await act(async () => {
      engine.mount(element, { library, theme: { ...DEFAULT_THEME, preset: "test" } });
      engine.loadPage(page, layout);
    });
    await settle();
  });

  afterEach(async () => {
    engine.destroy();
    await settle();
    element.remove();
  });

  const headings = () => [...element.querySelectorAll(".t-heading")].map((h) => h.textContent);
  /** Types into the inline text of the heading at `index` on the canvas. */
  const typeInto = async (index: number, text: string) => {
    const field = element.querySelectorAll<HTMLElement>(".t-heading [data-puck-overlay-portal]")[
      index
    ];
    await act(async () => {
      if (field === undefined) return;
      field.innerText = text;
      field.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await settle();
  };

  it("shows the Header, the page and the Footer", () => {
    expect(headings()).toEqual(["Shop", "First", "Second", "Thanks"]);
  });

  it("reports an edit in the Footer as shared, with the layout, and leaves the page alone", async () => {
    const edits: EngineEdit[] = [];
    engine.onUserEdit((edit) => edits.push(edit));

    await typeInto(3, "Thank you");

    expect(edits).toHaveLength(1);
    expect(edits[0]).toMatchObject({ kind: "text", nodeId: "f", shared: true });
    expect(edits[0]?.layout?.footer[0]?.props.text).toBe("Thank you");
    expect(edits[0]?.page.content.map((node) => node.props.id)).toEqual(["a", "b"]);
  });

  it("reports a page edit with the page's own content only", async () => {
    const edits: EngineEdit[] = [];
    engine.onUserEdit((edit) => edits.push(edit));

    await typeInto(1, "Changed");

    expect(edits[0]?.shared).toBeUndefined();
    expect(edits[0]?.page.content.map((node) => node.props.text)).toEqual(["Changed", "Second"]);
  });

  it("doesn't let the Footer itself be deleted, and keeps showing it", async () => {
    const edits: EngineEdit[] = [];
    engine.onUserEdit((edit) => edits.push(edit));
    await act(async () => engine.select("f"));
    await settle();

    await act(async () => {
      engine.perform("delete");
    });
    await settle();

    expect(edits).toEqual([]);
    expect(headings()).toEqual(["Shop", "First", "Second", "Thanks"]);
  });

  it("shows a layout change from outside, such as an undo", async () => {
    await act(async () =>
      engine.applyChange({
        page,
        layout: { ...layout, footer: [{ type: "Heading", props: { id: "f", text: "Bye" } }] },
      }),
    );
    await settle();

    expect(headings()).toEqual(["Shop", "First", "Second", "Bye"]);
  });

  it("adds a section within the page's own content with the floating +", async () => {
    const requests: unknown[] = [];
    engine.onAddRequest((at) => requests.push(at));

    for (const id of ["h", "b", "f"]) {
      await act(async () => engine.select(id));
      await settle();
      await act(async () => element.querySelector<HTMLButtonElement>(".wf-add")?.click());
    }

    // After the Header: the page's start; after the Footer: the page's end.
    expect(requests).toEqual([{ index: 0 }, { index: 2 }, { index: 2 }]);
  });

  it("shows a Site Settings value bound in the shared Header, and keeps the binding (1.17)", async () => {
    const edits: EngineEdit[] = [];
    engine.onUserEdit((edit) => edits.push(edit));
    const bound = {
      type: "Bound",
      props: { id: "hb", text: "Own", bindings: { text: "contact.phone" } },
    };
    await act(async () => {
      engine.setSettings({ setting: (key) => (key === "contact.phone" ? "0123" : undefined) });
      engine.loadPage(page, { ...layout, header: [bound] });
    });
    await settle();

    expect(headings()).toEqual(["0123", "First", "Second", "Thanks"]);

    // A page edit leaves the shared Header and its binding alone. Bound text isn't edited in
    // place, so the first inline text is the page's.
    await typeInto(0, "Changed");
    expect(edits[0]?.shared).toBeUndefined();
    expect(headings()).toEqual(["0123", "Changed", "Second", "Thanks"]);
  });

  it("offers no move, duplicate or delete on the Header or Footer itself", async () => {
    await act(async () => engine.select("f"));
    await settle();

    // Puck's own Layers list has its own Delete buttons; the quick actions are the action bar's.
    expect(element.querySelector('[class*="ActionBarAction"][title="Delete"]')).toBeNull();
    expect(element.querySelector('[title="Move up"]')).toBeNull();
  });
});

describe("createPuckEngine with linked copies of a shared section (F-ED-23)", () => {
  let element: HTMLDivElement;
  let engine: CanvasEngine;
  const HOURS = "shared-hours" as SharedSectionId;
  const shared: SharedSectionsDoc = {
    [HOURS]: {
      id: HOURS,
      name: "Opening hours",
      section: { type: "Heading", props: { id: "hours", text: "Hours" } },
    },
  };
  const withCopies: PageDoc = {
    root: { props: {} },
    content: [
      { type: "Heading", props: { id: "a", text: "First" } },
      { type: SHARED_COPY_TYPE, props: { id: "c1", sharedSectionId: HOURS } },
      { type: SHARED_COPY_TYPE, props: { id: "c2", sharedSectionId: HOURS, anchorSuffix: "2" } },
    ],
  };

  beforeEach(async () => {
    element = document.createElement("div");
    document.body.append(element);
    engine = createPuckEngine({ iframe: false });
    await act(async () => {
      engine.mount(element, { library, theme: { ...DEFAULT_THEME, preset: "test" } });
      engine.loadPage(withCopies, NO_LAYOUT, shared);
    });
    await settle();
  });

  afterEach(async () => {
    engine.destroy();
    await settle();
    element.remove();
  });

  const headings = () => [...element.querySelectorAll(".t-heading")].map((h) => h.textContent);
  const typeInto = async (index: number, text: string) => {
    const field = element.querySelectorAll<HTMLElement>(".t-heading [data-puck-overlay-portal]")[
      index
    ];
    await act(async () => {
      if (field === undefined) return;
      field.innerText = text;
      field.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await settle();
  };

  it("shows each copy as its shared section", () => {
    expect(headings()).toEqual(["First", "Hours", "Hours"]);
  });

  it("reports an edit in a copy as one to its shared section, and shows it in every copy", async () => {
    const edits: EngineEdit[] = [];
    engine.onUserEdit((edit) => edits.push(edit));

    await typeInto(2, "Open daily");

    expect(edits).toHaveLength(1);
    expect(edits[0]?.sharedSection).toEqual({
      id: HOURS,
      section: { type: "Heading", props: { id: "hours", text: "Open daily" } },
    });
    // The page itself is as it was: still two copies.
    expect(edits[0]?.page).toBe(withCopies);
    expect(edits[0]?.patch).toBeUndefined();
    expect(headings()).toEqual(["First", "Open daily", "Open daily"]);
  });

  it("reports an edit outside the copies as the page's own, its copies kept as copies", async () => {
    const edits: EngineEdit[] = [];
    engine.onUserEdit((edit) => edits.push(edit));

    await typeInto(0, "Welcome");

    expect(edits[0]?.sharedSection).toBeUndefined();
    expect(edits[0]?.page.content.map((node) => node.type)).toEqual([
      "Heading",
      SHARED_COPY_TYPE,
      SHARED_COPY_TYPE,
    ]);
    expect(edits[0]?.page.content[1]).toBe(withCopies.content[1]);
  });

  it("deletes a copy as a whole, from the page only", async () => {
    const edits: EngineEdit[] = [];
    engine.onUserEdit((edit) => edits.push(edit));
    await act(async () => engine.select(copiedNodeId("c1", "hours")));
    await settle();

    await act(async () => {
      engine.perform("delete");
    });
    await settle();

    expect(edits[0]?.kind).toBe("remove");
    expect(edits[0]?.sharedSection).toBeUndefined();
    expect(edits[0]?.page.content.map((node) => node.props.id)).toEqual(["a", "c2"]);
  });

  it("duplicates a copy as another linked copy, with anchors of its own", async () => {
    const edits: EngineEdit[] = [];
    engine.onUserEdit((edit) => edits.push(edit));
    await act(async () => engine.select(copiedNodeId("c1", "hours")));
    await settle();

    await act(async () => {
      engine.perform("duplicate");
    });
    await settle();

    const content = edits[0]?.page.content ?? [];
    expect(content.map((node) => node.type)).toEqual([
      "Heading",
      SHARED_COPY_TYPE,
      SHARED_COPY_TYPE,
      SHARED_COPY_TYPE,
    ]);
    expect(content[2]?.props).toMatchObject({ sharedSectionId: HOURS, anchorSuffix: "3" });
    // Selected as the canvas shows it.
    expect(edits[0]?.selection).toBe(copiedNodeId(String(content[2]?.props.id), "hours"));
    expect(headings()).toEqual(["First", "Hours", "Hours", "Hours"]);
  });

  it("shows a change to the shared section from outside, such as an undo, in every copy", async () => {
    await act(async () =>
      engine.applyChange({
        page: withCopies,
        shared: {
          [HOURS]: {
            id: HOURS,
            name: "Opening hours",
            section: { type: "Heading", props: { id: "hours", text: "Closed" } },
          },
        },
      }),
    );
    await settle();

    expect(headings()).toEqual(["First", "Closed", "Closed"]);
  });
});

describe("createPuckEngine before mount", () => {
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

describe("createPuckEngine's error boundary (R3)", () => {
  it("shows the boundary's fallback when an element throws, tells onError, and recovers", async () => {
    let broken = true;
    let tryAgain = () => undefined as void;
    class Boundary extends Component<{ readonly children: ReactNode }, { failed: boolean }> {
      override state = { failed: false };
      static getDerivedStateFromError() {
        return { failed: true };
      }
      override render(): ReactNode {
        if (!this.state.failed) return this.props.children;
        tryAgain = () => this.setState({ failed: false });
        return <p className="t-fallback">Something went wrong</p>;
      }
    }
    const throwing: ComponentLibrary = {
      components: {
        ...library.components,
        Broken: {
          label: "Broken",
          fields: {},
          defaults: {},
          render: () => {
            if (broken) throw new Error("Rosa's Bakery");
            return <p className="t-heading">Mended</p>;
          },
        },
      },
    };
    const onError = vi.fn();
    const element = document.createElement("div");
    document.body.append(element);
    const engine = createPuckEngine({ iframe: false });
    await act(async () => {
      engine.mount(element, {
        library: throwing,
        theme: { ...DEFAULT_THEME, preset: "test" },
        errorBoundary: Boundary,
        onError,
      });
      engine.loadPage(
        { ...page, content: [...page.content, { type: "Broken", props: { id: "x" } }] },
        NO_LAYOUT,
      );
    });
    await settle();

    expect(element.querySelector(".t-fallback")?.textContent).toBe("Something went wrong");
    expect(onError).toHaveBeenCalledWith(expect.any(Error), true);

    broken = false;
    await act(async () => tryAgain());
    await settle();
    expect([...element.querySelectorAll(".t-heading")].map((h) => h.textContent)).toEqual([
      "First",
      "Second",
      "Mended",
    ]);

    engine.destroy();
    await settle();
    element.remove();
  });
});
