import type { PageDoc } from "@webforge/model";
import { siteLibrary } from "@webforge/site-components";
import { describe, expect, it, vi } from "vitest";
import { starterSite } from "../../shared/starter-site.js";
import { sessionWith } from "../testing/fixtures.js";
import { createEditPanelController } from "./edit-panel-controller.js";
import { currentPage } from "./editor-session.js";

// The Edit panel's changes without React (#667): the controller makes each one history step.

/** The starter page, then Columns and an FAQ with two questions. */
function setup(nodeId = "heading-1") {
  const site = starterSite();
  const home = site.pages[site.homePageId];
  if (home === undefined) throw new Error("no home page");
  home.doc.content.push(
    {
      type: "Columns",
      props: { id: "columns", ...structuredClone(siteLibrary.components.Columns?.defaults ?? {}) },
    },
    {
      type: "Faq",
      props: {
        id: "faq",
        title: "Questions",
        items: [
          {
            type: "FaqItem",
            props: { id: "q1", question: "Open on Sunday?", answer: "<p>No</p>" },
          },
        ],
      },
    },
  );
  const session = sessionWith(site);
  session.select(nodeId);
  const flush = vi.fn();
  const controller = createEditPanelController(session, flush);
  const labels = () => session.history.entries().map((entry) => entry.label);
  const page = () => currentPage(session)?.doc.content ?? [];
  const props = (id: string) => {
    const find = (nodes: PageDoc["content"]): Record<string, unknown> | undefined => {
      for (const node of nodes) {
        if (node.props.id === id) return node.props;
        for (const value of Object.values(node.props)) {
          if (Array.isArray(value)) {
            const inside = find(value as PageDoc["content"]);
            if (inside !== undefined) return inside;
          }
        }
      }
      return undefined;
    };
    return find(page());
  };
  return { session, controller, flush, labels, props };
}

describe("createEditPanelController (#667)", () => {
  it("makes a choice one labelled step, after ending a canvas text session", () => {
    const { controller, flush, labels, props } = setup();
    // The starter Heading is large.
    controller.change("size", "small");
    expect(flush).toHaveBeenCalled();
    expect(props("heading-1")?.size).toBe("small");
    expect(labels()).toEqual(["Changed Heading size"]);
  });

  it("records no step for a value its field doesn't offer", () => {
    const { controller, labels, props } = setup();
    controller.change("size", "enormous");
    controller.change("size", 3);
    expect(props("heading-1")?.size).not.toBe("enormous");
    expect(labels()).toEqual([]);
  });

  it("makes one step of a visit to a text field, then another for the next visit", () => {
    const { controller, labels } = setup("faq");
    controller.change("title", "Q");
    controller.change("title", "Questions?");
    controller.commit("title");
    controller.change("title", "FAQ");
    expect(labels()).toHaveLength(2);
  });

  it("ends a field's run when the selection moves on, and cancels a drag when the panel goes", () => {
    const { session, controller, labels, props } = setup("columns");
    controller.change("gap", "small");
    controller.change("gap", "large");
    // The drag is one step, shown live.
    expect(props("columns")?.gap).toBe("large");
    controller.dispose();
    expect(props("columns")?.gap).toBe("medium");
    expect(labels()).toEqual([]);

    controller.change("gap", "small");
    session.select("heading-1");
    controller.follow("heading-1", "desktop");
    expect(labels()).toEqual(["Changed Columns space between columns"]);
  });

  it("pastes only values the element's fields take: a Section's gap none isn't one of Columns'", () => {
    const { controller, labels, props } = setup("columns");
    controller.paste({ gap: "none" }, "Spacing");
    expect(labels()).toEqual([]);
    expect(props("columns")?.gap).toBe("medium");

    controller.paste({ gap: "large", unknown: "x" }, "Spacing");
    expect(labels()).toEqual(["Pasted Spacing on Columns"]);
    expect(props("columns")?.gap).toBe("large");
  });

  it("refuses a list item's field the items don't have, and a malformed change", () => {
    const { controller, labels, props } = setup("faq");
    const items = () => props("faq")?.items as { props: Record<string, unknown> }[];
    controller.change("items", { type: "edit", id: "q1", name: "price", value: "£4" });
    controller.change("items", { type: "edit", id: "q1", name: "question", value: 4 });
    controller.change("items", { type: "move", id: "q1", to: "first" });
    controller.change("items", "add");
    expect(labels()).toEqual([]);
    expect(items()[0]?.props).not.toHaveProperty("price");

    controller.change("items", { type: "edit", id: "q1", name: "question", value: "Parking?" });
    controller.change("items", { type: "add" });
    expect(items().map((item) => item.props.question)).toEqual(["Parking?", expect.any(String)]);
    expect(labels()).toHaveLength(2);
  });

  it("ends a canvas text session with the latest flush it was given", () => {
    const { controller, flush } = setup();
    const later = vi.fn();
    controller.setFlush(later);
    controller.change("size", "small");
    expect(later).toHaveBeenCalled();
    expect(flush).not.toHaveBeenCalled();
  });

  it("does nothing once the element has gone", () => {
    const { session, controller, labels } = setup();
    session.select("nothing-here");
    controller.change("size", "small");
    controller.reset("size");
    controller.resetToDefault(["size"]);
    controller.paste({ size: "large" }, "Text");
    expect(labels()).toEqual([]);
  });

  it("drops a device's own value, and resets a field to its default, as one step each", () => {
    const { session, controller, labels, props } = setup("columns");
    session.setViewport("mobile");
    controller.change("gap", "small");
    controller.commit("gap");
    expect(props("columns")?.gap).toEqual({ $responsive: { desktop: "medium", mobile: "small" } });
    controller.reset("gap");
    expect(props("columns")?.gap).toBe("medium");

    session.setViewport("desktop");
    controller.change("gap", "large");
    controller.commit("gap");
    controller.resetToDefault(["gap"]);
    expect(props("columns")?.gap).toBe("medium");
    expect(labels()).toEqual([
      "Changed Columns space between columns on Mobile",
      "Reset Columns space between columns on Mobile",
      "Changed Columns space between columns",
      "Reset Columns space between columns",
    ]);
  });
});
