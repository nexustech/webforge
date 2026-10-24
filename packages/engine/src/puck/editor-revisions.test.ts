import type { PageDoc } from "@webforge/model";
import type { ComponentLibrary } from "@webforge/site-components";
import { describe, expect, it } from "vitest";
import { type EditorRevisions, remountStale } from "./editor-revisions.js";

const library: ComponentLibrary = {
  components: {
    Text: {
      label: "Text",
      fields: { body: { kind: "richtext", label: "Body" } },
      defaults: {},
      render: () => null,
    },
  },
};

const page = (...bodies: [string, string][]): PageDoc => ({
  root: { props: {} },
  content: bodies.map(([id, body]) => ({ type: "Text", props: { id, body } })),
});

describe("remountStale (ADR 0004, R8)", () => {
  it("remounts the editors whose text the change replaces, and forgets elements gone", () => {
    const revisions: EditorRevisions = new Map([["gone", 3]]);

    const refocus = remountStale(
      revisions,
      library,
      page(["a", "<p>1</p>"], ["b", "<p>2</p>"], ["gone", "<p>x</p>"]),
      page(["a", "<p>1</p>"], ["b", "<p>3</p>"]),
      null,
    );

    expect(Object.fromEntries(revisions)).toEqual({ b: 1 });
    expect(refocus).toBeNull();
  });

  it("gives the focus back to the editor being typed in when it is remounted", () => {
    const revisions: EditorRevisions = new Map([["b", 1]]);

    const refocus = remountStale(
      revisions,
      library,
      page(["b", "<p>2</p>"]),
      page(["b", "<p>3</p>"]),
      "b",
    );

    expect(revisions.get("b")).toBe(2);
    expect(refocus).toBe("b");
  });
});
