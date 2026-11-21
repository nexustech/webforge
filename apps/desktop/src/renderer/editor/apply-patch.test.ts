import type { EnginePatch } from "@webforge/engine";
import { createHistoryManager } from "@webforge/history";
import type { PageDoc } from "@webforge/model";
import { describe, expect, it } from "vitest";
import { applyPatch, updateField } from "./apply-patch.js";

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

describe("a text marked as an example, edited (#1228)", () => {
  const marked: PageDoc = {
    root: { props: {} },
    content: [
      {
        type: "Text",
        props: { id: "hours", text: "Open 9am", title: "Hours", examples: { text: true } },
      },
      {
        type: "Faq",
        props: {
          id: "faq",
          items: [
            { id: "a", question: "Price?", answer: "£12" },
            { id: "b", question: "When?", answer: "Mon" },
          ],
          examples: { "items.a.answer": true, "items.b.answer": true },
        },
      },
    ],
  };
  const edited = (nodeId: string, field: string, next: (current: unknown) => unknown) => {
    const history = createHistoryManager({ initial: marked });
    history.run("Edit", (draft) => {
      updateField(draft, marked, nodeId, field, next);
    });
    return { props: history.document.getState().content, steps: history.entries().length };
  };

  it("loses its mark in the same step; another field's edit keeps it", () => {
    const text = edited("hours", "text", () => "Open 10am");
    expect(text.props[0]?.props.examples).toBeUndefined();
    expect(text.steps).toBe(1);
    expect(edited("hours", "title", () => "Times").props[0]?.props.examples).toEqual({
      text: true,
    });
    // Written as it was: nothing edited, the mark stays.
    expect(edited("hours", "text", (current) => current).props[0]?.props.examples).toEqual({
      text: true,
    });
  });

  it("in a list, loses the edited item's mark only, wherever the item moves", () => {
    const items = (current: unknown) => current as { id: string; answer: string }[];
    const answered = edited("faq", "items", (current) =>
      items(current).map((item) => (item.id === "a" ? { ...item, answer: "£14" } : item)),
    );
    expect(answered.props[1]?.props.examples).toEqual({ "items.b.answer": true });
    // Reordered, nothing edited: both keep their marks; one removed loses its mark.
    const moved = edited("faq", "items", (current) => [...items(current)].reverse());
    expect(moved.props[1]?.props.examples).toEqual({
      "items.a.answer": true,
      "items.b.answer": true,
    });
    const removed = edited("faq", "items", (current) => items(current).slice(1));
    expect(removed.props[1]?.props.examples).toEqual({ "items.b.answer": true });
  });
});
