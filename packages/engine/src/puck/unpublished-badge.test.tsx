// @vitest-environment happy-dom
import { DEFAULT_THEME, HIDDEN_ATTRIBUTE, type PageDoc } from "@webforge/model";
import { type ComponentLibrary, slotComponent, textValue } from "@webforge/site-components";
import { act } from "react";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import type { CanvasEngine, ElementRequest } from "../canvas-engine.js";
import { createPuckEngine } from "./puck-engine.js";
import { UNPUBLISHED_BADGE_CLASS } from "./unpublished-badge.js";

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
      fields: { text: { kind: "text", label: "Text", inline: true } },
      defaults: { text: "Heading" },
      render: ({ values }) => <p className="t-heading">{textValue(values.text)}</p>,
    },
  },
};

/**
 * A Box set to Don't Publish with one inside it set so too, and a Box that's published, with one
 * of its own not published.
 */
const page: PageDoc = {
  root: { props: {} },
  content: [
    {
      type: "Box",
      props: {
        id: "kept",
        hidden: true,
        content: [
          { type: "Heading", props: { id: "inner", text: "Inner", hidden: true } },
          { type: "Heading", props: { id: "shown", text: "Shown" } },
        ],
      },
    },
    {
      type: "Box",
      props: {
        id: "open",
        content: [
          { type: "Heading", props: { id: "own", hidden: true } },
          { type: "Heading", props: { id: "plain", text: "Plain" } },
        ],
      },
    },
  ],
};

/** Lets Puck's effects and deferred dispatches run. */
async function settle(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
}

describe("an unpublished element's badge on the canvas (#1512)", { timeout: 15_000 }, () => {
  let element: HTMLDivElement;
  let engine: CanvasEngine;
  let selected: string | null;
  let requests: ElementRequest[];

  beforeEach(async () => {
    element = document.createElement("div");
    document.body.append(element);
    engine = createPuckEngine({ iframe: false });
    selected = null;
    requests = [];
    engine.onSelectionChange((id) => {
      selected = id;
    });
    engine.onElementRequest((request) => requests.push(request));
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

  /** The badge in Puck's wrapper around element `id`, if it has one. */
  const badgeOf = (id: string) =>
    element.querySelector(`[data-puck-component="${id}"] > .${UNPUBLISHED_BADGE_CLASS}`);
  const select = async (id: string) => {
    await act(async () => engine.select(id));
    await settle();
  };
  const showOf = (id: string) =>
    badgeOf(id)?.querySelector<HTMLButtonElement>(`.${UNPUBLISHED_BADGE_CLASS}__show`) ?? null;

  it("marks each element set to Don't Publish after it, named for a screen reader", () => {
    for (const id of ["kept", "inner", "own"]) {
      const badge = badgeOf(id);
      expect(badge, id).not.toBeNull();
      // After the element, which stays its wrapper's first, and dimmed (F-ED-12).
      expect(badge?.previousElementSibling?.hasAttribute(HIDDEN_ATTRIBUTE), id).toBe(true);
      const label = badge?.querySelector("button");
      expect(label?.getAttribute("aria-label")).toBe("Not published: left out of your website");
      expect(label?.textContent).toBe("Not published");
      expect(label?.getAttribute("data-wf-tip")).toBe("Not published: left out of your website");
    }
    expect(badgeOf("shown")).toBeNull();
    expect(badgeOf("open")).toBeNull();
  });

  it("is the outermost's only: one inside another unpublished element is in it, which hides it", () => {
    // The canvas's CSS hides a badge inside a dimmed element: `[hidden] .wf-unpublished`.
    expect(badgeOf("kept")?.closest(`[${HIDDEN_ATTRIBUTE}]`)).toBeNull();
    expect(badgeOf("inner")?.closest(`[${HIDDEN_ATTRIBUTE}]`)).not.toBeNull();
    expect(badgeOf("own")?.closest(`[${HIDDEN_ATTRIBUTE}]`)).toBeNull();
  });

  it("selects its element on a click, and offers Show once it's selected, as one request", async () => {
    expect(showOf("kept")).toBeNull();

    await act(async () => badgeOf("kept")?.querySelector("button")?.click());
    await settle();
    expect(selected).toBe("kept");

    const show = showOf("kept");
    expect(show?.textContent).toBe("Show");
    await act(async () => show?.click());
    expect(requests).toEqual([{ kind: "toggleHidden", nodeId: "kept" }]);
    // Only the selected element's badge offers it.
    expect(showOf("own")).toBeNull();
  });

  it("selects its own element, not the one around it, which sees no click (#1512)", async () => {
    await act(async () => badgeOf("own")?.querySelector("button")?.click());
    await settle();

    expect(selected).toBe("own");
    expect(showOf("own")).not.toBeNull();
  });

  it("is the canvas's only: the page as the export draws it, for the Recent list's picture, has none", () => {
    const html = engine.staticPage(page, { header: [], footer: [] })?.main;

    expect(html).toContain("Plain");
    expect(html).not.toContain(UNPUBLISHED_BADGE_CLASS);
    expect(html).not.toContain("Not published");
  });

  it("says so in Content mode too, without Show, which changes the layout (M3)", async () => {
    await act(async () => engine.setMode("content"));
    await select("own");

    expect(badgeOf("own")).not.toBeNull();
    expect(showOf("own")).toBeNull();
  });
});
