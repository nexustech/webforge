import type { NodeDoc } from "@webforge/model";
import { Window } from "happy-dom";
import { afterEach, describe, expect, it } from "vitest";
import { BEHAVIOUR_SCRIPTS } from "../behaviours.js";
import { siteLibrary } from "../catalogue/index.js";
import { EDITOR_RENDER_CONTEXT } from "../library.js";
import { renderNodesToHtml } from "../render-static.js";

// The "tabs" behaviour (2.11, WAI-ARIA tabs) on Tabs as the export renders them.

const windows: Window[] = [];
afterEach(async () => {
  for (const happy of windows.splice(0)) await happy.happyDOM.close();
});

const tab = (id: string, label: string, content: NodeDoc[] = []): NodeDoc => ({
  type: "Tab",
  props: { id, label, content },
});
const text = (id: string, words: string): NodeDoc => ({
  type: "Text",
  props: { id, text: `<p>${words}</p>` },
});

/** A page of its own with Tabs of `tabs`, and `tabs.js` run on it unless `script` is false. */
function page(tabs: NodeDoc[], { script = true } = {}) {
  const happy = new Window();
  windows.push(happy);
  const window = happy as unknown as typeof globalThis;
  const { document } = window;
  document.body.innerHTML = renderNodesToHtml(
    [{ type: "Tabs", props: { id: "menu", tabs } }],
    siteLibrary,
    EDITOR_RENDER_CONTEXT,
  );
  if (script) {
    new Function("document", "HTMLElement", "HTMLTemplateElement", BEHAVIOUR_SCRIPTS.tabs ?? "")(
      document,
      window.HTMLElement,
      window.HTMLTemplateElement,
    );
  }
  const buttons = () => [...document.querySelectorAll("[role=tab]")] as HTMLElement[];
  const panels = () => [...document.querySelectorAll("[data-wf-tab]")] as HTMLElement[];
  const shown = () =>
    panels()
      .filter((panel) => !panel.hidden)
      .map((panel) => panel.id);
  const press = (key: string, options: KeyboardEventInit = {}) => {
    const event = new window.KeyboardEvent("keydown", { key, bubbles: true, ...options });
    document.activeElement?.dispatchEvent(event);
  };
  return { document, buttons, panels, shown, press };
}

const MENU = [
  tab("a", "Breakfast", [text("a1", "Eggs and toast")]),
  tab("b", "Lunch", [text("b1", "Soup")]),
  tab("c", "Cakes", [text("c1", "Lemon drizzle")]),
];

describe("tabs on the exported page (2.11, WCAG 2.1 AA)", () => {
  it("shows every panel under its label without the script, nothing hidden", () => {
    const { document, buttons, panels, shown } = page(MENU, { script: false });

    expect(buttons()).toHaveLength(0);
    expect(document.querySelector("[role=tablist]")?.hasAttribute("hidden")).toBe(true);
    expect(shown()).toEqual(["tab-a", "tab-b", "tab-c"]);
    expect(panels().map((panel) => panel.querySelector("h3")?.textContent)).toEqual([
      "Breakfast",
      "Lunch",
      "Cakes",
    ]);
  });

  it("makes a tab of each panel's label, the first selected and its panel alone shown", () => {
    const { document, buttons, panels, shown } = page(MENU);
    const list = document.querySelector("[role=tablist]");

    expect(list?.hasAttribute("hidden")).toBe(false);
    expect(buttons().map((button) => button.textContent)).toEqual(["Breakfast", "Lunch", "Cakes"]);
    expect(buttons().map((button) => button.getAttribute("aria-selected"))).toEqual([
      "true",
      "false",
      "false",
    ]);
    // One tab in the Tab order; each panel labelled by its tab, its heading left to the tab.
    expect(buttons().map((button) => button.tabIndex)).toEqual([0, -1, -1]);
    const [first] = panels();
    expect(first?.getAttribute("role")).toBe("tabpanel");
    expect(first?.getAttribute("aria-labelledby")).toBe(buttons()[0]?.id);
    expect(buttons()[0]?.getAttribute("aria-controls")).toBe("tab-a");
    expect(first?.querySelector("h3")?.hidden).toBe(true);
    expect(shown()).toEqual(["tab-a"]);
  });

  it("moves with the arrow keys round past either end, Home and End, showing at once", () => {
    const { document, buttons, shown, press } = page(MENU);
    buttons()[0]?.focus();

    press("ArrowLeft");
    expect(shown()).toEqual(["tab-c"]);
    expect(document.activeElement).toBe(buttons()[2]);
    press("ArrowRight");
    expect(shown()).toEqual(["tab-a"]);
    press("End");
    expect(shown()).toEqual(["tab-c"]);
    press("Home");
    expect(shown()).toEqual(["tab-a"]);
    // With a modifier the keys are the browser's.
    press("ArrowRight", { altKey: true });
    expect(shown()).toEqual(["tab-a"]);
  });

  it("shows a tab's panel when it is clicked", () => {
    const { buttons, shown } = page(MENU);

    buttons()[1]?.click();

    expect(shown()).toEqual(["tab-b"]);
    expect(buttons()[1]?.getAttribute("aria-selected")).toBe("true");
    expect(buttons()[1]?.classList.contains("tab-active")).toBe(true);
    expect(buttons()[0]?.classList.contains("tab-active")).toBe(false);
  });

  it("leaves tabs inside a panel to themselves", () => {
    const inner: NodeDoc = {
      type: "Tabs",
      props: { id: "inner", tabs: [tab("x", "Hot"), tab("y", "Cold")] },
    };
    const { document } = page([tab("a", "Drinks", [inner]), tab("b", "Food")]);

    const lists = [...document.querySelectorAll("[role=tablist]")];
    expect(lists.map((list) => list.querySelectorAll("[role=tab]").length)).toEqual([2, 2]);
    expect(lists[0]?.textContent).toBe("DrinksFood");
    expect(lists[1]?.textContent).toBe("HotCold");
  });
});
