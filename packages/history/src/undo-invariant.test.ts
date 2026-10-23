import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { createHistoryManager, type HistoryManager } from "./history-manager.js";

// Undo invariant (U8, research/stack/03-undo-redo.md "Test strategy"): for any sequence of user
// actions, undo all returns exactly to the initial document and redo all to the final one.
// The document mirrors the shape of a page: nodes with props and nested slot content.

type Node = { type: string; props: { id: string; text: string; children: Node[] } };
type Page = { root: { props: { title: string } }; content: Node[] };

const initial: Page = {
  root: { props: { title: "Home" } },
  content: [{ type: "Heading", props: { id: "n0", text: "Welcome", children: [] } }],
};

type Ctx = { history: HistoryManager<Page, string | null>; tick: (ms: number) => void };

type Command = { readonly name: string; run(ctx: Ctx): void };

const index = fc.nat({ max: 6 });
const text = fc.string({ maxLength: 6 });

/** Picks the list at `depth` (0 = page content, 1 = first node's children). */
function listAt(draft: Page, depth: number): Node[] {
  if (depth === 0) return draft.content;
  return draft.content[0]?.props.children ?? draft.content;
}

const newNode = (type: string, id: number): Node => ({
  type,
  props: { id: `n${id}`, text: "", children: [] },
});

const commands: fc.Arbitrary<Command>[] = [
  fc
    .record({
      at: index,
      depth: fc.nat({ max: 1 }),
      type: fc.constantFrom("Heading", "Text"),
      id: fc.nat(),
    })
    .map(({ at, depth, type, id }) => ({
      name: `insert ${type} ${depth}:${at}`,
      run: ({ history }) =>
        history.run(`Added ${type}`, (draft) => {
          const list = listAt(draft, depth);
          list.splice(Math.min(at, list.length), 0, newNode(type, id));
        }),
    })),
  fc.record({ at: index, depth: fc.nat({ max: 1 }) }).map(({ at, depth }) => ({
    name: `remove ${depth}:${at}`,
    run: ({ history }) =>
      history.run("Deleted element", (draft) => {
        const list = listAt(draft, depth);
        if (list.length > 0) list.splice(at % list.length, 1);
      }),
  })),
  fc.record({ from: index, to: index }).map(({ from, to }) => ({
    name: `move ${from}->${to}`,
    run: ({ history }) =>
      history.run("Moved element", (draft) => {
        const list = draft.content;
        if (list.length === 0) return;
        const [node] = list.splice(from % list.length, 1);
        if (node) list.splice(Math.min(to, list.length), 0, node);
      }),
  })),
  fc
    .record({ at: index, value: text, pause: fc.nat({ max: 2_000 }) })
    .map(({ at, value, pause }) => ({
      name: `type ${at} "${value}" after ${pause}ms`,
      run: ({ history, tick }) => {
        tick(pause);
        history.run(
          "Edited text",
          (draft) => {
            const node = draft.content[at % Math.max(draft.content.length, 1)];
            if (node) node.props.text += value;
          },
          { coalesceKey: `text:${at}` },
        );
      },
    })),
  fc.record({ value: text }).map(({ value }) => ({
    name: `title "${value}"`,
    run: ({ history }) =>
      history.run(
        "Edited page title",
        (draft) => {
          draft.root.props.title = value;
        },
        { coalesceKey: "title", coalesceWindowMs: Number.POSITIVE_INFINITY },
      ),
  })),
  fc
    .record({ moves: fc.array(fc.tuple(index, index), { maxLength: 8 }), keep: fc.boolean() })
    .map(({ moves, keep }) => ({
      name: `drag ${JSON.stringify(moves)} ${keep ? "commit" : "cancel"}`,
      run: ({ history }) => {
        const tx = history.begin("Moved element");
        for (const [from, to] of moves) {
          tx.update((draft) => {
            const list = draft.content;
            if (list.length === 0) return;
            const [node] = list.splice(from % list.length, 1);
            if (node) list.splice(Math.min(to, list.length), 0, node);
          });
        }
        if (keep) tx.commit();
        else tx.cancel();
      },
    })),
  fc.nat({ max: 6 }).map((at) => ({
    name: `end session ${at}`,
    run: ({ history }) => history.endSession(`text:${at}`),
  })),
  // Changes that fail (#238): a recipe that throws, and one that changes the history from inside.
  // Neither may leave a trace.
  fc.constantFrom("throw", "nested").map((kind) => ({
    name: `${kind} mid-recipe`,
    run: ({ history }: Ctx) => {
      const before = history.document.getState();
      expect(() =>
        history.run("Broken", (draft) => {
          draft.root.props.title = "Broken";
          if (kind === "throw") throw new Error("broken recipe");
          history.undo();
        }),
      ).toThrow();
      expect(history.document.getState()).toBe(before);
    },
  })),
  fc.constant({ name: "undo", run: ({ history }: Ctx) => void history.undo() }),
  fc.constant({ name: "redo", run: ({ history }: Ctx) => void history.redo() }),
  fc.constant({ name: "break", run: ({ history }: Ctx) => history.breakCoalescing() }),
  fc.nat().map((at) => ({
    name: `jump ${at}`,
    run: ({ history }) => {
      const entries = history.entries();
      history.jumpTo(entries.length === 0 ? null : (entries[at % entries.length]?.id ?? null));
    },
  })),
];

function setup(limit?: number, maxBytes?: number): Ctx {
  let time = 0;
  let selected: string | null = null;
  const history = createHistoryManager<Page, string | null>({
    initial,
    selection: { get: () => selected, restore: (value) => (selected = value) },
    now: () => time,
    ...(limit === undefined ? {} : { limit }),
    ...(maxBytes === undefined ? {} : { maxBytes }),
  });
  return { history, tick: (ms) => (time += ms) };
}

describe("undo invariant", () => {
  it("undo all restores the initial document and redo all the final one", () => {
    fc.assert(
      fc.property(fc.array(fc.oneof(...commands), { maxLength: 40 }), (sequence) => {
        const ctx = setup();
        for (const command of sequence) command.run(ctx);
        const { history } = ctx;
        const current = history.document.getState();
        const cursor = history.state.getState().cursor;

        history.jumpTo(null);
        expect(history.document.getState()).toEqual(initial);

        const entries = history.entries();
        history.jumpTo(entries[cursor - 1]?.id ?? null);
        expect(history.document.getState()).toEqual(current);

        // Step by step agrees with jumping.
        while (history.redo()) {
          // redo everything
        }
        const final = history.document.getState();
        while (history.undo()) {
          // undo everything
        }
        expect(history.document.getState()).toEqual(initial);
        history.jumpTo(entries.at(-1)?.id ?? null);
        expect(history.document.getState()).toEqual(final);
      }),
      { numRuns: 300 },
    );
  });

  it("with a bounded history, undo all reaches the oldest kept state", () => {
    const edits = commands.slice(0, 6);
    fc.assert(
      fc.property(fc.array(fc.oneof(...edits), { maxLength: 30 }), (sequence) => {
        const bounded = setup(5);
        const unbounded = setup();
        for (const command of sequence) {
          command.run(bounded);
          command.run(unbounded);
        }
        expect(bounded.history.document.getState()).toEqual(unbounded.history.document.getState());
        const all = unbounded.history.entries();
        expect(bounded.history.entries()).toEqual(all.slice(-5));

        bounded.history.jumpTo(null);
        unbounded.history.jumpTo(all.at(-6)?.id ?? null);
        expect(bounded.history.document.getState()).toEqual(unbounded.history.document.getState());
      }),
      { numRuns: 100 },
    );
  });

  it("with a memory budget, undo all reaches the oldest kept state", () => {
    const edits = commands.slice(0, 6);
    fc.assert(
      fc.property(
        fc.array(fc.oneof(...edits), { maxLength: 30 }),
        fc.integer({ min: 100, max: 3_000 }),
        (sequence, maxBytes) => {
          const bounded = setup(undefined, maxBytes);
          const unbounded = setup();
          for (const command of sequence) {
            command.run(bounded);
            command.run(unbounded);
          }
          expect(bounded.history.document.getState()).toEqual(
            unbounded.history.document.getState(),
          );
          const all = unbounded.history.entries();
          const kept = bounded.history.entries();
          expect(kept).toEqual(all.slice(all.length - kept.length));
          const size = kept.reduce(
            (sum, entry) =>
              sum + JSON.stringify(entry.forward).length + JSON.stringify(entry.inverse).length,
            0,
          );
          if (kept.length > 1) expect(size).toBeLessThanOrEqual(maxBytes);

          bounded.history.jumpTo(null);
          unbounded.history.jumpTo(all.at(-kept.length - 1)?.id ?? null);
          expect(bounded.history.document.getState()).toEqual(
            unbounded.history.document.getState(),
          );
        },
      ),
      { numRuns: 100 },
    );
  });

  it("never loses typed text when coalescing", () => {
    fc.assert(
      fc.property(
        fc.array(fc.tuple(text, fc.nat({ max: 3_000 })), { minLength: 1, maxLength: 30 }),
        (keystrokes) => {
          const ctx = setup();
          let expected = "Welcome";
          for (const [value, pause] of keystrokes) {
            expected += value;
            ctx.tick(pause);
            ctx.history.run(
              "Edited Heading text",
              (draft) => {
                const node = draft.content[0];
                if (node) node.props.text += value;
              },
              { coalesceKey: "text:0" },
            );
          }
          ctx.history.endSession("text:0");

          expect(ctx.history.document.getState().content[0]?.props.text).toBe(expected);
          expect(ctx.history.entries().length).toBeLessThanOrEqual(1);
          ctx.history.undo();
          expect(ctx.history.document.getState()).toEqual(initial);
        },
      ),
    );
  });
});
