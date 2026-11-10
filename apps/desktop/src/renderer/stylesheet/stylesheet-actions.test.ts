import type { NodeDoc, SiteDoc } from "@webforge/model";
import { afterEach, describe, expect, it, vi } from "vitest";
import { starterSite } from "../../shared/starter-site.js";
import type { ItemCssApi } from "../editor/item-css.js";
import { sessionWith } from "../testing/fixtures.js";
import {
  editStylesheet,
  moveLookToCss,
  stylesheetOf,
  targetSelected,
} from "./stylesheet-actions.js";

const heading = (id: string, props: Record<string, unknown> = {}): NodeDoc => ({
  type: "Heading",
  props: { id, text: "Opening times", ...props },
});

/** A session on a site whose home page has `nodes`, with `css` as its stylesheet. */
function setUp(nodes: NodeDoc[], css = "") {
  const site: SiteDoc = structuredClone(starterSite());
  const home = site.pages[site.homePageId];
  if (home === undefined) throw new Error("No home page");
  home.doc.content = nodes;
  site.code.css = css;
  const session = sessionWith(site);
  const labels = () => session.history.entries().map((entry) => entry.label);
  const node = (id: string) =>
    session.history.document
      .getState()
      .pages[site.homePageId]?.doc.content.find((each) => each.props.id === id);
  return { session, labels, node, css: () => stylesheetOf(session.history.document.getState()) };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("editStylesheet (CT-8, 6.8)", () => {
  it("makes each stretch of typing one undo step, which a pause ends", () => {
    vi.useFakeTimers();
    const { session, labels, css } = setUp([]);

    editStylesheet(session, ".a");
    vi.advanceTimersByTime(200);
    editStylesheet(session, ".a {");
    vi.advanceTimersByTime(200);
    editStylesheet(session, ".a {}");
    expect(labels()).toEqual(["Edited site CSS"]);

    vi.advanceTimersByTime(5000);
    editStylesheet(session, ".a {}\n.b {}");
    expect(labels()).toEqual(["Edited site CSS", "Edited site CSS"]);
    expect(css()).toBe(".a {}\n.b {}");

    session.history.undo();
    expect(css()).toBe(".a {}");
    session.history.undo();
    expect(css()).toBe("");
  });

  it("makes no step when nothing changed", () => {
    const { session, labels } = setUp([], ".a {}");

    editStylesheet(session, ".a {}");
    expect(labels()).toEqual([]);
  });
});

describe("targetSelected (CT-8)", () => {
  it("adds a rule for the element's anchor, the caret inside it", () => {
    const { session, labels, css } = setUp(
      [heading("hours", { advanced: { anchorId: "hours" } })],
      ".a {}",
    );
    session.select("hours");

    const done = targetSelected(session);

    expect(css()).toBe(".a {}\n\n#hours {\n  \n}\n");
    expect(done).toEqual({ caret: ".a {}\n\n#hours {\n  ".length });
    expect(labels()).toEqual(["Targeted Heading in the stylesheet"]);
  });

  it("gives an element without an anchor a class of its own, in the same step", () => {
    const { session, labels, css, node } = setUp([
      heading("hours", { advanced: { className: "big" } }),
    ]);
    session.select("hours");

    targetSelected(session);

    expect(node("hours")?.props.advanced).toEqual({ className: "big heading" });
    expect(css()).toBe(".heading {\n  \n}\n");
    expect(labels()).toHaveLength(1);
    session.history.undo();
    expect(node("hours")?.props.advanced).toEqual({ className: "big" });
    expect(css()).toBe("");
  });

  it("says to select an element when none is", () => {
    const { session } = setUp([heading("hours")]);

    expect(targetSelected(session)).toEqual({ refused: "Select an element on the canvas first." });
  });
});

describe("moveLookToCss (CT-8)", () => {
  /** The worker: the item with `rootClass` on its element, and each class's rule. */
  const api = (rootClass: string): ItemCssApi => ({
    itemHtml: vi.fn(async () => ({
      status: "html" as const,
      html: `<!-- item --><h2 class="${rootClass}"><span>Opening times</span></h2>`,
    })),
    classCss: vi.fn(async (_theme, classes: readonly string[]) => ({
      status: "css" as const,
      css: classes.map((name) => `.${CSS.escape(name)} {\n  --set: 1;\n}`),
    })),
  });

  it("turns the element's own look into a rule under a class of its own, in one step", async () => {
    const { session, labels, css, node } = setUp(
      [heading("hours", { lookOpacity: "50", lookCorners: "large" })],
      ".a {}",
    );
    session.select("hours");

    const done = await moveLookToCss(session, api("text-3xl rounded-box! opacity-50!"));

    expect(done).toEqual({ caret: ".a {}\n\n".length, moved: 2, kept: 0 });
    expect(css()).toBe(".a {}\n\n.heading {\n  --set: 1;\n}\n.heading {\n  --set: 1;\n}\n");
    expect(node("hours")?.props.lookOpacity).toBeUndefined();
    expect(node("hours")?.props.lookCorners).toBeUndefined();
    expect(node("hours")?.props.advanced).toEqual({ className: "heading" });
    expect(labels()).toEqual(["Moved Heading's look to CSS"]);
    session.history.undo();
    expect(node("hours")?.props.lookOpacity).toBe("50");
    expect(css()).toBe(".a {}");
  });

  it("leaves a setting that styles a part inside the element", async () => {
    const { session, node } = setUp([
      heading("hours", { lookOpacity: "50", lookCorners: "large" }),
    ]);
    session.select("hours");

    const done = await moveLookToCss(session, api("opacity-50!"));

    expect(done).toMatchObject({ moved: 1, kept: 1 });
    expect(node("hours")?.props.lookCorners).toBe("large");
    expect(node("hours")?.props.lookOpacity).toBeUndefined();
  });

  it("says when there's no look of its own to move", async () => {
    const { session, labels } = setUp([heading("hours")]);
    session.select("hours");

    expect(await moveLookToCss(session, api(""))).toMatchObject({ refused: expect.any(String) });
    expect(labels()).toEqual([]);
  });
});
