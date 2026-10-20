// @vitest-environment happy-dom

import { type Data, Puck, type PuckAction, useGetPuck } from "@puckeditor/core";
import type { NodeDoc, PageDoc } from "@webforge/model";
import type { ComponentLibrary } from "@webforge/site-components";
import fc from "fast-check";
import { act, type ReactNode, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { toPuckConfig } from "./config.js";
import { toPageDoc } from "./edit-from-action.js";
import { pageActions, type SlotsOf } from "./page-actions.js";
import { allNodes, ROOT_ZONE } from "./tree.js";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const library: ComponentLibrary = {
  components: {
    Section: {
      label: "Section",
      fields: { content: { kind: "slot", label: "Content" } },
      defaults: { content: [] },
      render: ({ slots }) => {
        const Content = slots.content;
        return <section>{Content === undefined ? null : <Content />}</section>;
      },
    },
    Heading: {
      label: "Heading",
      fields: {
        text: { kind: "text", label: "Text" },
        size: { kind: "select", label: "Size", options: [] },
      },
      defaults: { text: "Heading", size: "medium" },
      render: ({ values }) => <h2>{String(values.text)}</h2>,
    },
  },
};

const SLOTS: Record<string, readonly string[]> = { Section: ["content"], Heading: [] };
const slotsOf: SlotsOf = (type) => SLOTS[type];

const heading = (id: string, text = id, size = "medium"): NodeDoc => ({
  type: "Heading",
  props: { id, text, size },
});
const section = (id: string, content: NodeDoc[]): NodeDoc => ({
  type: "Section",
  props: { id, content },
});
const pageOf = (content: NodeDoc[], root: Record<string, unknown> = {}): PageDoc => ({
  root: { props: root },
  content,
});

describe("pageActions", () => {
  const a = heading("a");
  const b = heading("b");
  const inner = heading("inner");
  const s = section("s", [inner]);
  const before = pageOf([a, s, b]);

  it("translates nothing for the same page", () => {
    expect(pageActions(before, before, slotsOf)).toEqual([]);
  });

  it("replaces only a changed element, even when it is nested", () => {
    const changed = heading("inner", "New");
    const after = pageOf([a, section("s", [changed]), b]);

    expect(pageActions(before, after, slotsOf)).toEqual([
      { type: "replace", destinationZone: "s:content", destinationIndex: 0, data: changed },
    ]);
  });

  it("removes an element", () => {
    expect(pageActions(before, pageOf([a, b]), slotsOf)).toEqual([
      { type: "remove", zone: ROOT_ZONE, index: 1 },
    ]);
  });

  it("inserts a new element with its props and children", () => {
    const added = section("new", [heading("child")]);
    const after = pageOf([a, s, added, b]);

    expect(pageActions(before, after, slotsOf)).toEqual([
      {
        type: "insert",
        componentType: "Section",
        id: "new",
        destinationZone: ROOT_ZONE,
        destinationIndex: 2,
      },
      { type: "replace", destinationZone: ROOT_ZONE, destinationIndex: 2, data: added },
    ]);
  });

  it.each([
    ["down", [s, b, a], [0, 2]],
    ["up", [b, a, s], [2, 0]],
    ["by one", [s, a, b], [0, 1]],
  ])("moves an element %s within a list", (_, content, [from, to]) => {
    expect(pageActions(before, pageOf(content), slotsOf)).toEqual([
      {
        type: "move",
        sourceZone: ROOT_ZONE,
        sourceIndex: from,
        destinationZone: ROOT_ZONE,
        destinationIndex: to,
      },
    ]);
  });

  it("moves an element between lists, and updates it if it changed too", () => {
    const edited = heading("a", "Edited");
    const after = pageOf([section("s", [inner, edited]), b]);

    expect(pageActions(before, after, slotsOf)).toEqual([
      {
        type: "move",
        sourceZone: ROOT_ZONE,
        sourceIndex: 0,
        destinationZone: "s:content",
        destinationIndex: 1,
      },
      { type: "replace", destinationZone: "s:content", destinationIndex: 1, data: edited },
    ]);
  });

  it("moves an element out of a nested list", () => {
    const after = pageOf([a, inner, section("s", []), b]);

    expect(pageActions(before, after, slotsOf)).toEqual([
      {
        type: "move",
        sourceZone: "s:content",
        sourceIndex: 0,
        destinationZone: ROOT_ZONE,
        destinationIndex: 1,
      },
    ]);
  });

  it("changes page settings", () => {
    const after = pageOf([a, s, b], { title: "About" });

    expect(pageActions(before, after, slotsOf)).toEqual([
      { type: "replaceRoot", root: { props: { title: "About" } } },
    ]);
  });

  it.each([
    ["a removed page setting", pageOf([a, s, b], { title: "x" }), before],
    ["two added elements", before, pageOf([heading("x"), a, s, b, heading("y")])],
    ["two moved elements", before, pageOf([b, s, a])],
    ["a swap between lists", before, pageOf([inner, section("s", [a]), b])],
    ["an element moved into a removed one's place", before, pageOf([a, section("t", [inner])])],
    ["an element of an unknown type", before, pageOf([a, { type: "Gone", props: { id: "s" } }, b])],
    ["a changed type", before, pageOf([a, section("b", [])].concat(s))],
    ["a list changed inside a moved element", before, pageOf([section("s", []), a, b])],
  ])("leaves %s to the whole-page update", (_, from, to) => {
    expect(pageActions(from, to, slotsOf)).toBeNull();
  });

  it("leaves an element added with an id that is still elsewhere to the whole-page update", () => {
    const after = pageOf([a, s, b, heading("inner")]);

    expect(pageActions(before, after, slotsOf)).toBeNull();
  });
});

// The translated actions, run through Puck's own reducer, must give the page `setData` gives.

type GetPuck = ReturnType<typeof useGetPuck>;

/** Normalises Puck's data the way Puck itself does: no undefined props, no root id or type. */
function normalised(data: Partial<Data> | PageDoc): unknown {
  const page = toPageDoc(data as Partial<Data>);
  const { id: _id, ...rootProps } = page.root.props;
  return JSON.parse(JSON.stringify({ root: { props: rootProps }, content: page.content }));
}

type Shape = { readonly kind: "Section" | "Heading"; readonly children: readonly Shape[] };

const headingShape: fc.Arbitrary<Shape> = fc.constant({ kind: "Heading", children: [] });
const shape: fc.Arbitrary<Shape> = fc.oneof(
  headingShape,
  fc
    .array(headingShape, { maxLength: 3 })
    .map((children): Shape => ({ kind: "Section", children })),
);

function build(shapes: readonly Shape[], prefix: string): PageDoc {
  let next = 0;
  const node = ({ kind, children }: Shape): NodeDoc => {
    const id = `${prefix}-${next++}`;
    return kind === "Heading" ? heading(id, `text ${id}`) : section(id, children.map(node));
  };
  return pageOf(shapes.map(node), { title: "Home" });
}

/** The lists of a page: the top level and every Section's content. */
function lists(page: PageDoc): NodeDoc[][] {
  return [
    page.content,
    ...allNodes(page)
      .filter((n) => n.type === "Section")
      .map((n) => n.props.content as NodeDoc[]),
  ];
}

type Edit = { readonly kind: string; readonly a: number; readonly b: number; readonly c: number };

const edit: fc.Arbitrary<Edit> = fc.record({
  kind: fc.constantFrom("text", "size", "insert", "remove", "move", "root"),
  a: fc.nat(),
  b: fc.nat(),
  c: fc.nat(),
});

/** Applies a user-like edit to `page` in place. */
function applyEdit(page: PageDoc, { kind, a, b, c }: Edit, newId: string): void {
  const nodes = allNodes(page);
  const all = lists(page);
  const pick = <T,>(items: readonly T[], n: number) => items[n % items.length];
  switch (kind) {
    case "text":
    case "size": {
      const node = pick(
        nodes.filter((n) => n.type === "Heading"),
        a,
      );
      if (node !== undefined) node.props[kind] = `${kind} ${b}`;
      return;
    }
    case "insert": {
      const list = pick(all, a) ?? page.content;
      list.splice(b % (list.length + 1), 0, heading(newId, "new"));
      return;
    }
    case "remove": {
      const list = pick(
        all.filter((l) => l.length > 0),
        a,
      );
      list?.splice(b % list.length, 1);
      return;
    }
    case "move": {
      const from = pick(
        all.filter((l) => l.length > 0),
        a,
      );
      if (from === undefined) return;
      const [moved] = from.splice(b % from.length, 1);
      if (moved === undefined) return;
      // The moved element is out of the page now, so it can't land in its own content.
      const to = pick(lists(page), c) ?? page.content;
      to.splice(c % (to.length + 1), 0, moved);
      return;
    }
    default:
      page.root.props.title = `title ${a}`;
  }
}

describe("pageActions with Puck's reducer", () => {
  let host: HTMLDivElement;
  let root: Root;
  let getPuck: GetPuck | null = null;

  beforeAll(async () => {
    function Capture({ children }: { children: ReactNode }) {
      const get = useGetPuck();
      useEffect(() => {
        getPuck = get;
      }, [get]);
      return <>{children}</>;
    }
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    await act(async () => {
      root.render(
        <Puck
          config={toPuckConfig(library)}
          data={{ root: { props: {} }, content: [] }}
          overrides={{ puck: Capture, header: () => <></> }}
          iframe={{ enabled: false }}
        />,
      );
    });
  });

  afterAll(async () => {
    await act(async () => root.unmount());
    host.remove();
  });

  const show = (page: PageDoc, actions: readonly PuckAction[] | null) => {
    const get = getPuck;
    if (get === null) throw new Error("Puck isn't ready");
    act(() => {
      for (const action of actions ?? [{ type: "setData", data: () => page as Data }]) {
        get().dispatch({ ...action, recordHistory: false } as PuckAction);
      }
    });
    return normalised(get().appState.data);
  };

  it("gives the same page as setData for any undo or redo step", () => {
    let run = 0;
    fc.assert(
      fc.property(
        fc.array(shape, { maxLength: 5 }),
        fc.array(edit, { minLength: 1, maxLength: 3 }),
        (shapes, edits) => {
          // Ids unique across runs, so nothing Puck remembers from an earlier run can match.
          const prefix = `r${run++}`;
          const before = build(shapes, prefix);
          const after = structuredClone(before);
          for (const [i, e] of edits.entries()) applyEdit(after, e, `${prefix}-new${i}`);
          const actions = pageActions(before, after, slotsOf);

          show(before, null);
          const viaActions = show(after, actions);
          show(before, null);
          const viaSetData = show(after, null);

          expect(viaActions).toEqual(viaSetData);
          expect(viaActions).toEqual(normalised(after));
          if (edits.length === 1) {
            // A single step is always translated.
            expect(actions).not.toBeNull();
          }
        },
      ),
      { numRuns: 100 },
    );
    // Each run renders four pages through Puck.
  }, 60_000);
});
