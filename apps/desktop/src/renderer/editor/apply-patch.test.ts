import type { EnginePatch } from "@webforge/engine";
import { createHistoryManager } from "@webforge/history";
import type { PageDoc } from "@webforge/model";
import { describe, expect, it } from "vitest";
import { applyPatch } from "./apply-patch.js";

const page: PageDoc = {
  root: { props: {} },
  content: [
    { type: "Heading", props: { id: "top", text: "Top" } },
    {
      type: "Section",
      props: {
        id: "section",
        content: [
          { type: "Text", props: { id: "first", text: "First" } },
          {
            type: "Faq",
            props: {
              id: "faq",
              items: [{ type: "FaqItem", props: { id: "deep", question: "Why?" } }],
            },
          },
        ],
      },
    },
  ],
};

/** Applies `patch` through a history, as the editor does; returns the result and the entry. */
function patched(patch: EnginePatch) {
  const history = createHistoryManager({ initial: page });
  let found: boolean | undefined;
  history.run("Edit", (draft) => {
    found = applyPatch(draft, page, patch);
  });
  return { found, next: history.document.getState(), entries: history.entries() };
}

describe("applyPatch", () => {
  it("sets one field of a nested node and records only that change", () => {
    const { found, next, entries } = patched({ nodeId: "deep", field: "question", value: "How?" });

    expect(found).toBe(true);
    expect(entries[0]?.forward).toEqual([
      {
        op: "replace",
        path: ["content", 1, "props", "content", 1, "props", "items", 0, "props", "question"],
        value: "How?",
      },
    ]);
    // Everything off the node's path keeps its identity.
    expect(next.content[0]).toBe(page.content[0]);
    const firstChild = (doc: PageDoc) =>
      (doc.content[1]?.props.content as PageDoc["content"] | undefined)?.[0];
    expect(firstChild(next)).toBe(firstChild(page));
  });

  it("adds a field the node didn't have", () => {
    const { next } = patched({ nodeId: "top", field: "size", value: "large" });

    expect(next.content[0]?.props).toEqual({ id: "top", text: "Top", size: "large" });
  });

  it("reports a node that isn't in the page", () => {
    const { found, next, entries } = patched({ nodeId: "missing", field: "text", value: "x" });

    expect(found).toBe(false);
    expect(entries).toEqual([]);
    expect(next).toEqual(page);
  });
});
