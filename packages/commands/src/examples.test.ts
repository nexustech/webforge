import { findNode, type NodeDoc } from "@webforge/model";
import { describe, expect, it } from "vitest";
import { createCommandApi } from "./api.js";
import { app, content, home, setup } from "./api.test-helper.js";

/**
 * The in-app assistant and AI apps write text through these commands (#1228, WN-3): each call here
 * stands in for a model's, flagging its examples or not.
 */
function writing() {
  const { history, host } = setup();
  const api = createCommandApi(host);
  const location = home(history);
  const node = (id: string) => findNode(content(history), (each) => each.props.id === id);
  const marks = (id: string) => node(id)?.props.examples;
  return { history, api, location, node, marks };
}

describe("text an AI writes holds an example (#1228, WN-3)", () => {
  it("is marked when it holds a detail the site doesn't give, whether flagged or not", async () => {
    const { api, location, marks, history } = writing();
    const steps = history.entries().length;

    await api.run(
      "editText",
      { location, nodeId: "heading", field: "text", text: "Call 020 7946 0123 today" },
      app,
    );
    expect(marks("heading")).toEqual({ text: true });
    // In the same step as the text: undone together.
    expect(history.entries()).toHaveLength(steps + 1);
    history.undo();
    expect(marks("heading")).toBeUndefined();

    // Flagged, with no detail Webforge would know: marked as the app says.
    await api.run(
      "editText",
      { location, nodeId: "heading", field: "text", text: "Loved by our regulars", example: true },
      app,
    );
    expect(marks("heading")).toEqual({ text: true });
  });

  it("isn't marked for a detail the site gives, and a rewrite without one clears the mark", async () => {
    const { api, location, marks, history } = writing();
    history.run("Set phone", (draft) => {
      draft.settings.contact.phone = "0113 496 0000";
    });

    await api.run(
      "editText",
      { location, nodeId: "heading", field: "text", text: "Call +44 113 496 0000" },
      app,
    );
    expect(marks("heading")).toBeUndefined();

    await api.run(
      "editText",
      { location, nodeId: "heading", field: "text", text: "Open from 7am" },
      app,
    );
    expect(marks("heading")).toEqual({ text: true });
    await api.run(
      "editText",
      { location, nodeId: "heading", field: "text", text: "Fresh bread every morning" },
      app,
    );
    expect(marks("heading")).toBeUndefined();
  });

  it("never takes an example for a given fact: reworded, or repeated elsewhere (PR 1289's review)", async () => {
    const { api, location, marks } = writing();

    // Made-up hours, flagged; then reworded unflagged: still made up, still marked.
    await api.run(
      "editText",
      { location, nodeId: "heading", field: "text", text: "Open 9am–5pm", example: true },
      app,
    );
    await api.run(
      "editText",
      {
        location,
        nodeId: "heading",
        field: "text",
        text: "We're open from 9am to 5pm",
      },
      app,
    );
    expect(marks("heading")).toEqual({ text: true });

    // The same hours written into another element, unflagged: marked there too.
    await api.run(
      "updateFields",
      { location, nodeId: "hero", values: { title: "Come by from 9am" } },
      app,
    );
    expect(marks("hero")).toEqual({ title: true });
  });

  it("marks the fields updateFields is told hold examples, and those that made a detail up", async () => {
    const { api, location, marks } = writing();

    const result = await api.run(
      "updateFields",
      {
        location,
        nodeId: "hero",
        values: { title: "Rolls from £2", text: "Baked by Margaret" },
        examples: ["text"],
      },
      app,
    );
    expect(result).toMatchObject({ status: "done" });
    expect(marks("hero")).toEqual({ title: true, text: true });
  });

  it("always marks a testimonial, and those in a section added with them", async () => {
    const { api, location, history } = writing();

    const added = await api.run(
      "addNode",
      { location, type: "Testimonials", parentId: null, slot: null },
      app,
    );
    expect(added.status).toBe("done");
    const testimonials: NodeDoc[] = [];
    findNode(content(history), (each) => {
      if (each.type === "Testimonial") testimonials.push(each);
      return false;
    });
    expect(testimonials.length).toBeGreaterThan(0);
    for (const testimonial of testimonials) {
      expect(Object.keys(testimonial.props.examples ?? {})).toContain("quote");
    }
  });
});
