// @vitest-environment happy-dom

import { Puck, useGetPuck } from "@puckeditor/core";
import { DEFAULT_THEME, type PageDoc } from "@webforge/model";
import { type ComponentLibrary, textValue } from "@webforge/site-components";
import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import type { CanvasEngine } from "../canvas-engine.js";
import {
  ACTIONS,
  ACTIONS_OVERLAY,
  CANVAS,
  CANVAS_ROOT,
  COMPONENT,
  COMPONENT_ATTRIBUTE,
  componentSelector,
  DRAWER_ITEM,
  HOVERED_COMPONENT,
  INLINE_TEXT,
  LAYOUT,
  OVERLAY,
  type PuckPrivateApi,
  puckPrivateApi,
  RICH_TEXT,
  ROOT_DROP_ZONE,
  SELECTED_COMPONENT,
} from "./puck-dom.js";
import { createPuckEngine } from "./puck-engine.js";

// Puck's DOM contract (R8): every selector and private API the engine uses, checked against Puck
// as it is installed. A Puck upgrade that renames one fails here, not in the E2E suite.

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

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
