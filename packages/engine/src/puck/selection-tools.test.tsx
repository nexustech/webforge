// @vitest-environment happy-dom
import {
  copiedNodeId,
  DEFAULT_THEME,
  type PageDoc,
  SHARED_COPY_TYPE,
  type SharedSectionId,
} from "@webforge/model";
import {
  APPEARANCE_FIELDS,
  type ComponentLibrary,
  slotComponent,
  textValue,
} from "@webforge/site-components";
import { act } from "react";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import type { CanvasEngine, ElementRequest } from "../canvas-engine.js";
import { createPuckEngine } from "./puck-engine.js";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// Puck's canvas starts a 500 ms timer when it mounts; let the last one fire while there's a window.
afterAll(async () => {
  await new Promise((resolve) => setTimeout(resolve, 600));
});

const library: ComponentLibrary = {
  components: {
    Box: {
      label: "Box",
      place: "section",
      fields: { content: { kind: "slot", label: "Content" } },
      defaults: { content: [] },
      render: (props) => {
        const Content = slotComponent(props, "content");
        return (
          <div className="t-box">
            <Content />
          </div>
        );
      },
    },
    Heading: {
      label: "Heading",
      // A look to style, as every Heading has (3.13a).
      fields: {
        text: { kind: "text", label: "Text", inline: true },
        lookShadow: APPEARANCE_FIELDS.lookShadow,
      },
      defaults: { text: "Heading" },
      render: ({ values }) => <p className="t-heading">{textValue(values.text)}</p>,
    },
    Picture: {
      label: "Picture",
      fields: { image: { kind: "media", label: "Image" } },
      defaults: {},
      render: () => <img alt="" />,
    },
  },
};

const page: PageDoc = {
  root: { props: {} },
  content: [
    {
      type: "Box",
      props: {
        id: "box",
        content: [
          { type: "Heading", props: { id: "first", text: "First" } },
          { type: "Picture", props: { id: "picture" } },
          { type: "Heading", props: { id: "last", text: "Last" } },
        ],
      },
    },
    { type: "Box", props: { id: "empty", content: [] } },
  ],
};

/** Lets Puck's effects and deferred dispatches run. */
async function settle(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
}

// Each test mounts Puck and clicks through it: a second or two alone, but slower beside the whole
// suite's other tests (coverage, parallel workers), so the 5 s default isn't always enough.
describe("selection tools (1.30, F-ED-25, F-ED-27)", { timeout: 15_000 }, () => {
  let element: HTMLDivElement;
  let engine: CanvasEngine;
  let selected: string | null;

  beforeEach(async () => {
    element = document.createElement("div");
    document.body.append(element);
    engine = createPuckEngine({ iframe: false });
    selected = null;
    engine.onSelectionChange((id) => {
      selected = id;
    });
    await act(async () => {
      engine.mount(element, { library, theme: { ...DEFAULT_THEME, preset: "test" } });
      engine.loadPage(page, { header: [], footer: [] });
    });
    await settle();
  });

  afterEach(async () => {
    engine.destroy();
    await settle();
    element.remove();
  });

  const perform = async (action: Parameters<CanvasEngine["perform"]>[0]) => {
    let done = false;
    await act(async () => {
      done = engine.perform(action);
    });
    await settle();
    return done;
  };
  const select = async (id: string) => {
    await act(async () => engine.select(id));
    await settle();
  };
  const button = (title: string) => element.querySelector<HTMLButtonElement>(`[title="${title}"]`);

  it("walks the page's tree: into an element, along its list and back out", async () => {
    await select("box");

    expect(await perform("selectChild")).toBe(true);
    expect(selected).toBe("first");
    expect(await perform("selectNextSibling")).toBe(true);
    expect(selected).toBe("picture");
    expect(await perform("selectNextSibling")).toBe(true);
    expect(selected).toBe("last");
    // The end of its list: it stays.
    expect(await perform("selectNextSibling")).toBe(false);
    expect(selected).toBe("last");
    expect(await perform("selectPreviousSibling")).toBe(true);
    expect(selected).toBe("picture");
    expect(await perform("selectParent")).toBe(true);
    expect(selected).toBe("box");
    // Never out of the page's sections, and nothing inside an element with nothing in it.
    expect(await perform("selectParent")).toBe(false);
    expect(await perform("selectNextSibling")).toBe(true);
    expect(selected).toBe("empty");
    expect(await perform("selectChild")).toBe(false);
  });

  it("adds with a Ctrl/Cmd-click, takes the shown one out, and gives the bar's actions way (1.31)", async () => {
    const changes: [string | null, boolean][] = [];
    engine.onSelectionChange((id, adding) => changes.push([id, adding]));
    const click = async (id: string, init: MouseEventInit = {}) => {
      await act(async () => {
        element
          .querySelector(`[data-puck-component="${id}"]`)
          ?.dispatchEvent(new MouseEvent("click", { bubbles: true, ...init }));
      });
      await settle();
    };

    await click("first");
    await click("picture", { ctrlKey: true });
    // On the one shown: Puck selects nothing new, so the engine says so itself.
    await click("picture", { metaKey: true });
    expect(changes).toEqual([
      ["first", false],
      ["picture", true],
      ["picture", true],
    ]);

    // While several are selected, the others are outlined and the bar only names the one shown.
    await act(async () => engine.showSelected(["first"]));
    await settle();
    expect(
      document.head.querySelector("style[data-webforge-also-selected]")?.textContent,
    ).toContain('[data-puck-component="first"]');
    expect(button("Edit")).toBeNull();
    await act(async () => engine.showSelected([]));
    await settle();
    expect(button("Edit")).not.toBeNull();
  });

  it("outlines an element named outside the canvas, one at a time (breadcrumbs)", async () => {
    const outlined = () =>
      [...element.querySelectorAll("[data-wf-outlined]")].map((each) =>
        each.getAttribute("data-puck-component"),
      );

    engine.outline("first");
    expect(outlined()).toEqual(["first"]);
    engine.outline("box");
    expect(outlined()).toEqual(["box"]);
    engine.outline("gone");
    engine.outline(null);

    expect(outlined()).toEqual([]);
  });

  it("starts editing the selected element's own text, the caret at its end", async () => {
    await select("first");

    expect(await perform("editText")).toBe(true);

    const field = element.querySelector('[data-puck-component="first"] [contenteditable]');
    expect(element.ownerDocument.activeElement).toBe(field);
    expect(field?.getAttribute("contenteditable")).toBe("plaintext-only");
    // A Box has no text of its own: its elements' text is theirs.
    await select("box");
    expect(await perform("editText")).toBe(false);
  });

  it("offers Edit for text and images, and Hide, asking the app for what it owns", async () => {
    const requests: ElementRequest[] = [];
    engine.onElementRequest((request) => requests.push(request));

    await select("first");
    expect(button("Edit")).not.toBeNull();
    await act(async () => button("Edit")?.click());
    expect(element.ownerDocument.activeElement?.getAttribute("contenteditable")).toBe(
      "plaintext-only",
    );
    await act(async () => button("Hide")?.click());
    // Style this ‹kind›… for an element with a look (3.13a).
    await act(async () => button("Style")?.click());

    await select("picture");
    await act(async () => button("Edit")?.click());
    // A Box has nothing to edit.
    await select("box");
    expect(button("Edit")).toBeNull();

    expect(requests).toEqual([
      { kind: "toggleHidden", nodeId: "first" },
      { kind: "style", nodeId: "first" },
      { kind: "pickImage", nodeId: "picture" },
    ]);
  });

  it("offers Hide only on the page's own elements: a linked copy whole, not inside it or the Header", async () => {
    const HOURS = "shared-hours" as SharedSectionId;
    const box = (id: string, inside: string) => ({
      type: "Box",
      props: { id, content: [{ type: "Heading", props: { id: inside, text: "Hours" } }] },
    });
    await act(async () =>
      engine.loadPage(
        {
          root: { props: {} },
          content: [{ type: SHARED_COPY_TYPE, props: { id: "c1", sharedSectionId: HOURS } }],
        },
        { header: [box("top", "logo")], footer: [] },
        { [HOURS]: { id: HOURS, name: "Opening hours", section: box("hours", "times") } },
      ),
    );
    await settle();

    await select(copiedNodeId("c1", "hours"));
    expect(button("Hide")).not.toBeNull();
    for (const id of [copiedNodeId("c1", "times"), "logo"]) {
      await select(id);
      expect(button("Edit")).not.toBeNull();
      expect(button("Hide")).toBeNull();
    }
    // Loading the Header and a shared section takes Puck a while on a busy machine.
  }, 20_000);

  it("says Show for a hidden element, and offers no Hide in Content mode (M3)", async () => {
    await act(async () =>
      engine.loadPage(
        {
          ...page,
          content: [{ type: "Heading", props: { id: "gone", text: "Gone", hidden: true } }],
        },
        { header: [], footer: [] },
      ),
    );
    await settle();
    await select("gone");
    expect(button("Show")).not.toBeNull();

    await act(async () => engine.setMode("content"));
    await settle();
    expect(button("Show")).toBeNull();
    expect(button("Edit")).not.toBeNull();
  });

  it("leaves Delete and Backspace to the app's key map: Puck's own hotkeys delete nothing", async () => {
    await select("first");
    const keys: string[] = [];
    const listen = (event: KeyboardEvent) => keys.push(event.key);
    window.addEventListener("keydown", listen);

    for (const key of ["Backspace", "Delete"]) {
      await act(async () => {
        document.body.dispatchEvent(
          new KeyboardEvent("keydown", { key, code: key, bubbles: true, cancelable: true }),
        );
      });
      await settle();
    }
    window.removeEventListener("keydown", listen);

    expect(element.querySelector('[data-puck-component="first"]')).not.toBeNull();
    // Still selected: its quick actions are there.
    expect(button("Edit")).not.toBeNull();
    expect(keys).toEqual(["Backspace", "Delete"]);
  });
});
