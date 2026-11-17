// @vitest-environment happy-dom

import { Puck, useGetPuck } from "@puckeditor/core";
import puckCss from "@puckeditor/core/puck.css?raw";
import { DEFAULT_THEME, type PageDoc } from "@webforge/model";
import { type ComponentLibrary, textValue } from "@webforge/site-components";
import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import type { CanvasEngine } from "../canvas-engine.js";
import {
  ACTION_BAR,
  ACTION_BAR_ACTION,
  ACTION_BAR_LABEL,
  ACTIONS,
  ACTIONS_OVERLAY,
  CANVAS,
  CANVAS_EVEN_SECTIONS,
  CANVAS_ROOT,
  COMPONENT,
  COMPONENT_ATTRIBUTE,
  COMPONENT_DROP_ZONE,
  componentSelector,
  DISABLED_ATTRIBUTE,
  DRAGGING,
  DRAWER_ITEM,
  DROP_PREVIEW,
  elementOf,
  HOVERED_COMPONENT,
  INLINE_TEXT,
  LAYOUT,
  OVERLAY,
  type PuckPrivateApi,
  puckPrivateApi,
  RICH_TEXT,
  RICH_TEXT_MENU,
  ROOT_DROP_ZONE,
  SELECTED_COMPONENT,
  TABLE_ROW_PASSAGES,
  TABLE_ROW_WRAPPER,
} from "./puck-dom.js";
import { createPuckEngine } from "./puck-engine.js";

// Puck's DOM contract (R8): every selector and private API the engine uses, checked against Puck
// as it is installed. A Puck upgrade that renames one fails here, not in the E2E suite.

// Puck's canvas starts a 500 ms timer when it mounts: let it end before the environment goes.
afterAll(async () => {
  await new Promise((resolve) => setTimeout(resolve, 600));
});

const library: ComponentLibrary = {
  components: {
    Heading: {
      label: "Heading",
      fields: { text: { kind: "text", label: "Text", inline: true } },
      defaults: { text: "Heading" },
      render: ({ values }) => <h2>{textValue(values.text)}</h2>,
    },
    Text: {
      label: "Text",
      fields: { body: { kind: "richtext", label: "Text", inline: true } },
      defaults: { body: "<p>Text</p>" },
      render: ({ values }) => <div>{values.body as ReactNode}</div>,
    },
  },
};

const page: PageDoc = {
  root: { props: {} },
  content: [
    { type: "Heading", props: { id: "a", text: "Welcome" } },
    { type: "Text", props: { id: "t", body: "<p>Tell visitors what you do.</p>" } },
  ],
};

/** Lets Puck's effects and deferred dispatches run. */
async function settle(ms = 30): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });
}

describe("Puck's DOM contract (R8)", () => {
  let element: HTMLDivElement;
  let engine: CanvasEngine;

  beforeEach(async () => {
    element = document.createElement("div");
    document.body.append(element);
    engine = createPuckEngine({ iframe: false });
    await act(async () => {
      engine.mount(element, { library, theme: { ...DEFAULT_THEME, preset: "test" } });
      engine.loadPage(page, { header: [], footer: [] });
    });
    await settle(50);
  });

  afterEach(async () => {
    engine.destroy();
    await settle();
    element.remove();
  });

  it("finds each element by its id, and every element's wrapper", () => {
    expect(element.querySelectorAll(COMPONENT)).toHaveLength(2);
    expect(element.querySelector(componentSelector("a"))?.getAttribute(COMPONENT_ATTRIBUTE)).toBe(
      "a",
    );
    expect(element.querySelector(componentSelector("a"))?.textContent).toContain("Welcome");
  });

  it("finds the canvas root, the page's drop zone and the rich-text editor", () => {
    expect(element.querySelector(CANVAS)).not.toBeNull();
    expect(element.querySelector(CANVAS_ROOT)).not.toBeNull();
    expect(element.querySelector(ROOT_DROP_ZONE)).not.toBeNull();
    expect(element.querySelector(`${componentSelector("t")} ${RICH_TEXT}`)).not.toBeNull();
  });

  it("finds Puck's layout around the canvas: its rail, sidebars and their box (#274)", () => {
    for (const selector of Object.values(LAYOUT)) {
      expect(element.querySelector(selector), selector).not.toBeNull();
    }
  });

  it("finds the overlay of the selected element, and its action bar's box and layer", async () => {
    await act(async () => engine.select("a"));
    await settle();

    expect(element.querySelector(OVERLAY)).not.toBeNull();
    // LF-3 moves the bar's box; HOVERED_COMPONENT needs a real pointer: canvas-chrome.spec.ts.
    expect(element.querySelector(`${OVERLAY} ${ACTIONS_OVERLAY} ${ACTIONS}`)).not.toBeNull();
    expect(element.querySelector(`${SELECTED_COMPONENT} ${ACTIONS}`)).not.toBeNull();
    // Its action bar: the element's name, and its actions by their titles (A20).
    expect(element.querySelector(`${ACTIONS} ${ACTION_BAR}`)).not.toBeNull();
    expect(element.querySelector(`${ACTION_BAR} ${ACTION_BAR_LABEL}`)?.textContent).toMatch(
      /^Heading/,
    );
    expect(element.querySelector(`${ACTION_BAR} ${ACTION_BAR_ACTION}[title]`)).not.toBeNull();
  });

  it("draws the rich-text menu over a selected rich text (A20)", async () => {
    await act(async () => engine.select("t"));
    await settle();

    expect(element.querySelector(RICH_TEXT_MENU)).not.toBeNull();
  });

  it("hovers an element with the pointer over its text, one element at a time (#399)", async () => {
    const heading = element.querySelector(componentSelector("a"));
    const text = element.querySelector(componentSelector("t"));
    const inline = heading?.querySelector(INLINE_TEXT);
    const editor = text?.querySelector(RICH_TEXT);
    if (heading == null || text == null || inline == null || editor == null) {
      throw new Error("the page isn't drawn as expected");
    }
    // Each hovered element's overlay, by the name its chip shows (SP-1).
    const hovered = () =>
      [...element.querySelectorAll(HOVERED_COMPONENT)].map((overlay) => overlay.textContent);
    const move = async (from: Element | null, to: Element) => {
      await act(async () => {
        from?.dispatchEvent(new MouseEvent("mouseout", { bubbles: true, relatedTarget: to }));
        to.dispatchEvent(new MouseEvent("mouseover", { bubbles: true, relatedTarget: from }));
      });
    };

    // Puck's text stops mouseover before it reaches the element (an overlay portal).
    await move(null, inline);
    expect(hovered()).toEqual([expect.stringMatching(/^Heading/)]);
    // From the Heading's text straight onto the Text's.
    await move(inline, editor);
    expect(hovered()).toEqual([expect.stringMatching(/^Text/)]);
  });

  it("keeps a hovered element hovered with the pointer on its +, until it leaves (#1129)", async () => {
    const heading = element.querySelector(componentSelector("a"));
    const text = element.querySelector(componentSelector("t"));
    // What the Heading draws, inside its wrapper, as a section's <section> fills the Section's.
    const drawn = heading?.querySelector("h2");
    if (heading == null || text == null || drawn == null) {
      throw new Error("the page isn't drawn as expected");
    }
    const hovered = () =>
      [...element.querySelectorAll(HOVERED_COMPONENT)].map((overlay) => overlay.textContent);
    const plus = () => element.querySelector('.wf-outline[data-wf-id="a"] .wf-add');
    const move = async (from: Element | null, to: Element) => {
      await act(async () => {
        from?.dispatchEvent(new MouseEvent("mouseout", { bubbles: true, relatedTarget: to }));
        to.dispatchEvent(new MouseEvent("mouseover", { bubbles: true, relatedTarget: from }));
      });
      await settle();
    };
    // The mouseouts Puck's listener on the Heading's wrapper gets, each one ending its hover.
    let outs = 0;
    const count = () => {
      outs += 1;
    };
    heading.addEventListener("mouseout", count);

    await move(null, drawn);
    const add = plus();
    if (add === null) throw new Error("a hovered section has no +");
    // From inside the Heading onto its +, outside the wrapper, in Puck's overlay: the Heading
    // stays hovered, + and all.
    outs = 0;
    await move(drawn, add);
    expect(hovered()).toEqual([expect.stringMatching(/^Heading/)]);
    expect(plus()).toBe(add);
    expect(outs).toBe(0);
    // Back into the Heading: still hovered, with no hover ended and started again.
    await move(add, drawn);
    expect(outs).toBe(0);
    expect(plus()).toBe(add);
    // From the wrapper itself onto the +, and back onto the wrapper.
    await move(heading, add);
    await move(add, heading);
    expect(outs).toBe(0);
    expect(hovered()).toEqual([expect.stringMatching(/^Heading/)]);
    // Off the + onto the next element: that one alone is hovered, and the + goes.
    await move(drawn, add);
    await move(add, text);
    expect(outs).toBe(1);
    expect(hovered()).toEqual([expect.stringMatching(/^Text/)]);
    expect(plus()).toBeNull();
    heading.removeEventListener("mouseout", count);
  });

  it("draws a drag source as an item of Puck's drawer", async () => {
    const item = document.createElement("div");
    document.body.append(item);
    let remove = () => {};
    await act(async () => {
      remove = engine.addDragSource(item, "Heading");
    });
    await settle();

    expect(item.querySelector(DRAWER_ITEM)).not.toBeNull();
    await act(async () => remove());
    item.remove();
  });
});

describe("what Puck marks only while a drag goes on (A20)", () => {
  it("is still named in Puck's stylesheet as installed", () => {
    // A pointer drag that happy-dom can't make sets them; the E2E drags use them (drag.ts).
    const names = [DRAGGING, DROP_PREVIEW, `[${DISABLED_ATTRIBUTE}]`].flatMap((selector) =>
      [...selector.matchAll(/\[([a-z-]+)\]/g)].map(([, name]) => name),
    );

    expect(names).toEqual([
      "data-puck-entry",
      "data-puck-dragging",
      "data-dnd-placeholder",
      "data-puck-line-placeholder",
      "data-puck-disabled",
    ]);
    for (const name of names) expect(puckCss, name).toContain(`[${name}]`);
  });
});

describe("the canvas's every second section (2.13d, A19)", () => {
  it("is every second section a visitor sees, in Puck's wrappers, the hidden ones left out", async () => {
    const bands: ComponentLibrary = {
      components: {
        Band: {
          label: "Band",
          place: "section",
          fields: { text: { kind: "text", label: "Text", inline: true } },
          defaults: { text: "Band" },
          render: ({ values }) => <section>{textValue(values.text)}</section>,
        },
      },
    };
    const band = (id: string, hidden = false) => ({
      type: "Band",
      props: { id, text: id, ...(hidden ? { hidden: true } : {}) },
    });
    const element = document.createElement("div");
    document.body.append(element);
    const engine = createPuckEngine({ iframe: false });
    await act(async () => {
      engine.mount(element, { library: bands, theme: { ...DEFAULT_THEME, preset: "test" } });
      engine.loadPage(
        {
          root: { props: {} },
          content: [band("a"), band("b", true), band("c"), band("d"), band("e")],
        },
        { header: [], footer: [] },
      );
    });
    await settle(50);

    const striped = [...element.querySelectorAll(CANVAS_EVEN_SECTIONS)].map(
      (section) => section.textContent,
    );

    // The second and fourth shown, c and e: b is hidden in Layers, which the export leaves out.
    expect(striped).toEqual(["c", "e"]);
    engine.destroy();
    await settle();
    element.remove();
  });
});

describe("a slot drawn as a list (#1134)", () => {
  it("is Puck's drop zone as the <ol> the component asks for, its items in their wrappers", async () => {
    const steps: ComponentLibrary = {
      components: {
        Steps: {
          label: "Steps",
          place: "section",
          fields: { items: { kind: "slot", label: "Steps", allow: ["Step"] } },
          defaults: { items: [] },
          render: ({ slots }) => {
            const Items = slots.items;
            return (
              <section>{Items === undefined ? null : <Items as="ol" className="grid" />}</section>
            );
          },
        },
        Step: {
          label: "Step",
          place: "child",
          fields: { title: { kind: "text", label: "Title", inline: true } },
          defaults: { title: "Step" },
          render: ({ values }) => <li className="site-step">{textValue(values.title)}</li>,
        },
      },
    };
    const step = (id: string) => ({ type: "Step", props: { id, title: id } });
    const element = document.createElement("div");
    document.body.append(element);
    const engine = createPuckEngine({ iframe: false });
    await act(async () => {
      engine.mount(element, { library: steps, theme: { ...DEFAULT_THEME, preset: "test" } });
      engine.loadPage(
        {
          root: { props: {} },
          content: [{ type: "Steps", props: { id: "s", items: [step("one"), step("two")] } }],
        },
        { header: [], footer: [] },
      );
    });
    await settle(50);

    const list = element.querySelector("section > ol.grid");
    // Each step in its wrapper, in the list: a layout on the list itself (a grid) lays them out.
    expect(
      [...(list?.children ?? [])].map((wrapper) => [
        wrapper.matches(COMPONENT),
        wrapper.querySelector("li.site-step")?.textContent,
      ]),
    ).toEqual([
      [true, "one"],
      [true, "two"],
    ]);
    engine.destroy();
    await settle();
    element.remove();
  });
});

describe("a table's rows on the canvas (6.16c)", () => {
  // A table whose rows are elements in its slot, as a Table's are. Happy-dom lays nothing out, so
  // what the rows look like (their boxes, the outline, the hover size, the menu's place and the
  // drag's placeholder) is checked in a real canvas, by e2e/app/table.spec.ts; here, that the
  // canvas styles' selectors find Puck's markup around them as installed.
  const tables: ComponentLibrary = {
    components: {
      Rows: {
        label: "Rows",
        fields: { rows: { kind: "slot", label: "Rows", allow: ["Row"] } },
        defaults: { rows: [] },
        render: ({ slots }) => {
          const Rows = slots.rows ?? (() => null);
          return (
            <table>
              <tbody>
                <Rows />
              </tbody>
            </table>
          );
        },
      },
      Row: {
        label: "Row",
        place: "child",
        fields: { cell: { kind: "text", label: "Cell", inline: true } },
        defaults: { cell: "Cell" },
        render: ({ values }) => (
          <tr>
            <td>{textValue(values.cell)}</td>
          </tr>
        ),
      },
    },
  };
  const row = (id: string) => ({ type: "Row", props: { id, cell: id } });

  let element: HTMLDivElement;
  let engine: CanvasEngine;

  beforeEach(async () => {
    element = document.createElement("div");
    document.body.append(element);
    engine = createPuckEngine({ iframe: false });
    await act(async () => {
      engine.mount(element, { library: tables, theme: { ...DEFAULT_THEME, preset: "test" } });
      engine.loadPage(
        {
          root: { props: {} },
          content: [{ type: "Rows", props: { id: "table", rows: [row("r1"), row("r2")] } }],
        },
        { header: [], footer: [] },
      );
    });
    await settle(50);
  });

  afterEach(async () => {
    engine.destroy();
    await settle();
    element.remove();
  });

  it("wraps each row in a wrapper of its own, the row its first child, in the slot's drop zone", () => {
    const wrappers = [...element.querySelectorAll(TABLE_ROW_WRAPPER)];

    expect(wrappers.map((wrapper) => wrapper.getAttribute(COMPONENT_ATTRIBUTE))).toEqual([
      "r1",
      "r2",
    ]);
    // What the hover size and the keyboard's menu measure: the row, not its wrapper.
    expect(elementOf(document, "r1")?.tagName).toBe("TR");
    // The body and the drop zone between it and the wrappers, which the rows pass through.
    const passages = [...element.querySelectorAll(TABLE_ROW_PASSAGES)];
    expect(passages.map((passage) => passage.tagName)).toEqual(["TBODY", "DIV"]);
    expect(passages[1]?.matches(COMPONENT_DROP_ZONE)).toBe(true);
    // The table's own wrapper isn't a row's: it's not in a body.
    expect(element.querySelector(componentSelector("table"))?.matches(TABLE_ROW_WRAPPER)).toBe(
      false,
    );
  });

  it("edits a cell where it is, and outlines a selected row with Puck's overlay", async () => {
    expect(
      element.querySelector(`${componentSelector("r1")} > tr td ${INLINE_TEXT}`),
    ).not.toBeNull();

    await act(async () => engine.select("r2"));
    await settle();

    expect(element.querySelector(OVERLAY)).not.toBeNull();
    expect(element.querySelector(`${ACTION_BAR} ${ACTION_BAR_LABEL}`)?.textContent).toMatch(/^Row/);
  });
});

describe("Puck's private API (R8)", () => {
  it("has what our Puck patch adds: the canvas zoom, and sending held-back rich text", async () => {
    let api: PuckPrivateApi | undefined;
    function Probe({ children }: { readonly children: ReactNode }) {
      api = puckPrivateApi(useGetPuck()());
      return <>{children}</>;
    }
    const element = document.createElement("div");
    document.body.append(element);
    const root = createRoot(element);
    await act(async () => {
      root.render(
        <Puck
          config={{ components: {} }}
          data={{ root: { props: {} }, content: [] }}
          overrides={{ puck: Probe }}
          iframe={{ enabled: false }}
        />,
      );
    });
    await settle();

    expect(api).toBeDefined();
    expect(typeof api?.getZoomConfig().zoom).toBe("number");
    // Nothing is being typed: nothing to send.
    expect(api?.flushRichText()).toBe(false);
    await act(async () => root.unmount());
    element.remove();
  });

  it("reports a missing private API as missing, not as a broken one", () => {
    expect(puckPrivateApi({})).toBeUndefined();
    expect(puckPrivateApi({ __private: { getZoomConfig: () => ({}) } })).toBeUndefined();
    expect(puckPrivateApi(null)).toBeUndefined();
  });
});
