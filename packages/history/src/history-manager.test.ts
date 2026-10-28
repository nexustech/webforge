import { describe, expect, it, vi } from "vitest";
import { createHistoryManager, HistoryError, type SelectionAdapter } from "./history-manager.js";

type Doc = { title: string; items: { id: string; text: string }[] };

const initial: Doc = { title: "Home", items: [{ id: "a", text: "Hello" }] };

function setup(options: { limit?: number; coalesceWindowMs?: number; maxBytes?: number } = {}) {
  let time = 1_000;
  let selected: string | null = null;
  const selection: SelectionAdapter<string | null> = {
    get: () => selected,
    restore: (value) => {
      selected = value;
    },
  };
  const history = createHistoryManager<Doc, string | null>({
    initial,
    selection,
    now: () => time,
    ...options,
  });
  return {
    history,
    doc: () => history.document.getState(),
    select: (id: string | null) => {
      selected = id;
    },
    selected: () => selected,
    tick: (ms: number) => {
      time += ms;
    },
  };
}

describe("mergeSince: what a dialog changed, as one step (3.13a)", () => {
  const retitle = (ctx: ReturnType<typeof setup>, title: string) =>
    ctx.history.run(`Title ${title}`, (draft) => {
      draft.title = title;
    });

  it("merges the steps after an entry into one, with its own label, undone and redone at once", () => {
    const ctx = setup();
    retitle(ctx, "Before");
    const before = ctx.history.entries().at(-1)?.id ?? null;
    retitle(ctx, "One");
    ctx.tick(5_000);
    ctx.history.run("Item", (draft) => {
      draft.items.push({ id: "b", text: "Two" });
    });

    expect(ctx.history.mergeSince(before, "Styled Feature")).toBe(true);

    expect(ctx.history.entries().map((entry) => entry.label)).toEqual([
      "Title Before",
      "Styled Feature",
    ]);
    expect(ctx.doc()).toMatchObject({ title: "One", items: [{ id: "a" }, { id: "b" }] });
    ctx.history.undo();
    expect(ctx.doc()).toMatchObject({ title: "Before", items: [{ id: "a" }] });
    ctx.history.redo();
    expect(ctx.doc()).toMatchObject({ title: "One", items: [{ id: "a" }, { id: "b" }] });
  });

  it("merges from the start for null, and nothing for nothing after the entry", () => {
    const ctx = setup();
    expect(ctx.history.mergeSince(null, "Nothing")).toBe(false);
    retitle(ctx, "One");
    const last = ctx.history.entries().at(-1)?.id ?? null;
    expect(ctx.history.mergeSince(last, "Nothing")).toBe(false);
    retitle(ctx, "Two");

    expect(ctx.history.mergeSince(null, "Both")).toBe(true);
    expect(ctx.history.entries().map((entry) => entry.label)).toEqual(["Both"]);
    expect(ctx.history.mergeSince("unknown", "Never")).toBe(false);
  });

  it("keeps later runs from merging into it, and leaves what was undone redoable", () => {
    const ctx = setup();
    ctx.history.run(
      "Type",
      (draft) => {
        draft.title = "A";
      },
      { coalesceKey: "title" },
    );
    ctx.history.run("Item", (draft) => {
      draft.items.push({ id: "b", text: "Two" });
    });
    ctx.history.undo();

    expect(ctx.history.mergeSince(null, "Styled")).toBe(true);
    expect(ctx.history.state.getState()).toMatchObject({ cursor: 1, canRedo: true });
    ctx.history.run(
      "Type",
      (draft) => {
        draft.title = "AB";
      },
      { coalesceKey: "title" },
    );
    expect(ctx.history.entries().map((entry) => entry.label)).toEqual(["Styled", "Type"]);
  });

  it("does nothing while a gesture is open", () => {
    const ctx = setup();
    retitle(ctx, "One");
    const gesture = ctx.history.begin("Drag");

    expect(ctx.history.mergeSince(null, "Styled")).toBe(false);
    gesture.cancel();
  });
});

describe("createHistoryManager", () => {
  it("starts with the initial document and no entries", () => {
    const { history, doc } = setup();

    expect(doc()).toEqual(initial);
    expect(history.entries()).toEqual([]);
    expect(history.state.getState()).toMatchObject({ cursor: 0, canUndo: false, canRedo: false });
  });

  it("freezes the document so it can only change through the history", () => {
    const { doc } = setup();

    expect(Object.isFrozen(doc())).toBe(true);
    expect(Object.isFrozen(doc().items[0])).toBe(true);
  });

  it("records one labelled entry per run and undoes and redoes it", () => {
    const { history, doc } = setup();

    history.run("Edited page title", (draft) => {
      draft.title = "About";
    });

    expect(doc().title).toBe("About");
    expect(history.entries().map((entry) => entry.label)).toEqual(["Edited page title"]);
    expect(history.undo()).toBe(true);
    expect(doc()).toEqual(initial);
    expect(history.state.getState()).toMatchObject({ canUndo: false, canRedo: true });
    expect(history.redo()).toBe(true);
    expect(doc().title).toBe("About");
  });

  it("ignores a run that changes nothing", () => {
    const { history } = setup();

    history.run("Nothing", () => undefined);

    expect(history.entries()).toEqual([]);
  });

  it("returns false when there is nothing to undo or redo", () => {
    const { history } = setup();

    expect(history.undo()).toBe(false);
    expect(history.redo()).toBe(false);
  });

  it("discards redoable entries when a new change is made", () => {
    const { history, doc } = setup();
    history.run("A", (draft) => {
      draft.title = "A";
    });
    history.run("B", (draft) => {
      draft.title = "B";
    });
    history.undo();

    history.run("C", (draft) => {
      draft.title = "C";
    });

    expect(history.entries().map((entry) => entry.label)).toEqual(["A", "C"]);
    expect(history.redo()).toBe(false);
    expect(doc().title).toBe("C");
  });

  it("notifies document subscribers on change, undo and redo", () => {
    const { history } = setup();
    const listener = vi.fn();
    history.document.subscribe(listener);

    history.run("A", (draft) => {
      draft.title = "A";
    });
    history.undo();
    history.redo();

    expect(listener).toHaveBeenCalledTimes(3);
  });

  describe("selection restore (U3)", () => {
    it("restores the selection from before the change on undo and after it on redo", () => {
      const { history, select, selected } = setup();
      select("a");
      history.run("Added Text", (draft) => {
        draft.items.push({ id: "b", text: "New" });
      });
      select("b");
      history.run("Edited Text text", (draft) => {
        const item = draft.items[1];
        if (item) item.text = "Changed";
      });
      select(null);

      history.undo();
      expect(selected()).toBe("b");
      history.undo();
      expect(selected()).toBe("a");
      history.redo();
      expect(selected()).toBe("a");
      history.redo();
      expect(selected()).toBe("b");
    });

    it("records an explicit selection after the change", () => {
      const { history, select, selected } = setup();
      select("a");
      history.run("Added Text", (draft) => void draft.items.push({ id: "b", text: "" }), {
        selectionAfter: "b",
      });
      history.undo();
      select(null);

      history.redo();

      expect(selected()).toBe("b");
    });

    it("works without a selection adapter", () => {
      const history = createHistoryManager<Doc>({ initial });
      history.run("A", (draft) => {
        draft.title = "A";
      });

      expect(history.undo()).toBe(true);
      expect(history.entries()[0]?.selectionBefore).toBeNull();
    });
  });

  describe("coalescing (rule 4)", () => {
    it("merges consecutive runs with the same key inside the window", () => {
      const { history, doc, tick } = setup();
      for (const title of ["H", "He", "Hel"]) {
        tick(300);
        history.run(
          "Edited page title",
          (draft) => {
            draft.title = title;
          },
          { coalesceKey: "title" },
        );
      }

      expect(history.entries()).toHaveLength(1);
      expect(history.entries()[0]?.forward).toEqual([
        { op: "replace", path: ["title"], value: "Hel" },
      ]);
      expect(history.entries()[0]?.inverse).toEqual([
        { op: "replace", path: ["title"], value: "Home" },
      ]);
      history.undo();
      expect(doc().title).toBe("Home");
    });

    it("starts a new entry after the window has passed", () => {
      const { history, tick } = setup({ coalesceWindowMs: 500 });
      const edit = (title: string) =>
        history.run(
          "Edited page title",
          (draft) => {
            draft.title = title;
          },
          { coalesceKey: "title" },
        );

      edit("A");
      tick(400);
      edit("AB");
      tick(600);
      edit("ABC");

      expect(history.entries()).toHaveLength(2);
    });

    it("honours a per-run window", () => {
      const { history, tick } = setup({ coalesceWindowMs: 10 });
      const edit = (title: string) =>
        history.run(
          "Edited page title",
          (draft) => {
            draft.title = title;
          },
          { coalesceKey: "title", coalesceWindowMs: Number.POSITIVE_INFINITY },
        );

      edit("A");
      tick(60_000);
      edit("AB");

      expect(history.entries()).toHaveLength(1);
    });

    it("does not merge runs with different keys or without a key", () => {
      const { history } = setup();
      history.run(
        "A",
        (draft) => {
          draft.title = "A";
        },
        { coalesceKey: "x" },
      );
      history.run(
        "B",
        (draft) => {
          draft.title = "B";
        },
        { coalesceKey: "y" },
      );
      history.run("C", (draft) => {
        draft.title = "C";
      });
      history.run("D", (draft) => {
        draft.title = "D";
      });

      expect(history.entries()).toHaveLength(4);
    });

    it("breaks the chain on undo, redo and breakCoalescing", () => {
      const { history } = setup();
      const edit = (title: string) =>
        history.run(
          "Edited page title",
          (draft) => {
            draft.title = title;
          },
          { coalesceKey: "title" },
        );

      edit("A");
      history.breakCoalescing();
      edit("AB");
      history.undo();
      edit("AC");
      history.undo();
      history.redo();
      edit("ACD");

      expect(history.entries().map((entry) => entry.forward[0]?.value)).toEqual(["A", "AC", "ACD"]);
    });

    it("keeps the selection from before the first merged run", () => {
      const { history, select, selected } = setup();
      select("a");
      history.run(
        "Edited",
        (draft) => {
          draft.title = "A";
        },
        { coalesceKey: "t" },
      );
      select("b");
      history.run(
        "Edited",
        (draft) => {
          draft.title = "AB";
        },
        { coalesceKey: "t" },
      );

      history.undo();

      expect(selected()).toBe("a");
    });
  });

  describe("text sessions (D1, U5)", () => {
    const type = (ctx: ReturnType<typeof setup>, text: string) => {
      ctx.tick(2_000);
      ctx.history.run(
        "Edited Text text",
        (draft) => {
          const item = draft.items[0];
          if (item) item.text = text;
        },
        { coalesceKey: "text:a" },
      );
    };

    it("undoes word by word during the session and the whole session after it ends", () => {
      const ctx = setup();
      ctx.history.run("Edited page title", (draft) => {
        draft.title = "About";
      });
      type(ctx, "Hello there");
      type(ctx, "Hello there friend");
      expect(ctx.history.entries()).toHaveLength(3);

      ctx.history.endSession("text:a");

      expect(ctx.history.entries().map((entry) => entry.label)).toEqual([
        "Edited page title",
        "Edited Text text",
      ]);
      ctx.history.undo();
      expect(ctx.doc().items[0]?.text).toBe("Hello");
      expect(ctx.doc().title).toBe("About");
    });

    it("keeps a session entry undone mid-session redoable after the session ends", () => {
      const ctx = setup();
      type(ctx, "Hello there");
      type(ctx, "Hello there friend");
      type(ctx, "Hello there friend!");
      ctx.history.undo();

      ctx.history.endSession("text:a");

      expect(ctx.history.entries()).toHaveLength(2);
      expect(ctx.doc().items[0]?.text).toBe("Hello there friend");
      ctx.history.redo();
      expect(ctx.doc().items[0]?.text).toBe("Hello there friend!");
      ctx.history.jumpTo(null);
      expect(ctx.doc()).toEqual(initial);
    });

    it("does nothing for a session of one entry, but stops merging", () => {
      const ctx = setup();
      type(ctx, "Hi");

      ctx.history.endSession("text:a");
      ctx.history.run(
        "Edited Text text",
        (draft) => {
          const item = draft.items[0];
          if (item) item.text = "Hi!";
        },
        { coalesceKey: "text:a", coalesceWindowMs: Number.POSITIVE_INFINITY },
      );

      expect(ctx.history.entries()).toHaveLength(2);
    });

    it("keeps two sessions of the same field as two steps", () => {
      const ctx = setup();
      type(ctx, "Hello there");
      type(ctx, "Hello there friend");
      ctx.history.endSession("text:a");
      type(ctx, "Hello there friend!");
      type(ctx, "Hello there friend!!");

      ctx.history.endSession("text:a");

      expect(ctx.history.entries()).toHaveLength(2);
      ctx.history.undo();
      expect(ctx.doc().items[0]?.text).toBe("Hello there friend");
    });

    it("closes a one-entry session so the next session stays separate", () => {
      const ctx = setup();
      type(ctx, "Hi");
      ctx.history.endSession("text:a");
      type(ctx, "Hi!");
      type(ctx, "Hi!!");

      ctx.history.endSession("text:a");

      expect(ctx.history.entries()).toHaveLength(2);
    });

    it("leaves other chains open", () => {
      const ctx = setup();
      ctx.history.run(
        "A",
        (draft) => {
          draft.title = "A";
        },
        { coalesceKey: "title" },
      );

      ctx.history.endSession("text:a");
      ctx.history.run(
        "A",
        (draft) => {
          draft.title = "AB";
        },
        { coalesceKey: "title" },
      );

      expect(ctx.history.entries()).toHaveLength(1);
    });
  });

  describe("transactions (gestures, U2)", () => {
    it("records a gesture with many updates as one step", () => {
      const { history, doc } = setup();
      const tx = history.begin("Moved Text");
      expect(history.state.getState().transaction).toBe("Moved Text");

      for (let step = 0; step < 60; step++) {
        tx.update((draft) => {
          draft.title = `step ${step}`;
        });
      }
      tx.update((draft) => {
        draft.items.unshift({ id: "b", text: "Moved" });
      });
      tx.commit();

      expect(history.entries()).toHaveLength(1);
      expect(history.state.getState().transaction).toBeNull();
      history.undo();
      expect(doc()).toEqual(initial);
      history.redo();
      expect(doc().title).toBe("step 59");
      expect(doc().items).toHaveLength(2);
    });

    it("compacts the patches of a replace-only gesture", () => {
      const { history } = setup();
      const tx = history.begin("Changed padding");
      for (const title of ["1", "2", "3"]) {
        tx.update((draft) => {
          draft.title = title;
        });
      }
      tx.commit();

      expect(history.entries()[0]?.forward).toHaveLength(1);
    });

    it("applies updates live", () => {
      const { history, doc } = setup();
      const tx = history.begin("Moved Text");

      tx.update((draft) => {
        draft.title = "Live";
      });

      expect(doc().title).toBe("Live");
      expect(tx.active).toBe(true);
    });

    it("restores document and selection on cancel without an entry", () => {
      const { history, doc, select, selected } = setup();
      select("a");
      const tx = history.begin("Moved Text");
      tx.update((draft) => {
        draft.title = "Live";
      });
      select("b");

      tx.cancel();

      expect(doc()).toBe(history.document.getInitialState());
      expect(selected()).toBe("a");
      expect(history.entries()).toEqual([]);
      expect(tx.active).toBe(false);
    });

    it("records nothing when committed without changes", () => {
      const { history } = setup();

      history.begin("Moved Text").commit();

      expect(history.entries()).toEqual([]);
    });

    it("uses the label and selection given to commit", () => {
      const { history, select, selected } = setup();
      const tx = history.begin("Moving");
      tx.update((draft) => {
        draft.title = "X";
      });
      tx.commit({ label: "Moved Text", selectionAfter: "a" });
      history.undo();
      select(null);
      history.redo();

      expect(history.entries()[0]?.label).toBe("Moved Text");
      expect(selected()).toBe("a");
    });

    it("blocks other changes and undo while open", () => {
      const { history } = setup();
      history.run("A", (draft) => {
        draft.title = "A";
      });
      const tx = history.begin("Moved Text");

      expect(() => history.run("B", () => undefined)).toThrow(HistoryError);
      expect(() => history.begin("Other")).toThrow(/in progress/);
      expect(() => history.clear()).toThrow(HistoryError);
      expect(history.undo()).toBe(false);
      expect(history.redo()).toBe(false);
      expect(history.jumpTo(null)).toBe(false);
      tx.cancel();
      expect(history.undo()).toBe(true);
    });

    it("rejects use after commit or cancel", () => {
      const { history } = setup();
      const tx = history.begin("Moved Text");
      tx.commit();

      expect(() => tx.update(() => undefined)).toThrow(HistoryError);
      expect(() => tx.commit()).toThrow(/already committed or cancelled/);
      expect(() => tx.cancel()).toThrow(HistoryError);
    });

    it("never merges a later run into a gesture", () => {
      const { history } = setup();
      history.run(
        "A",
        (draft) => {
          draft.title = "A";
        },
        { coalesceKey: "t" },
      );
      const tx = history.begin("G");
      tx.update((draft) => {
        draft.title = "G";
      });
      tx.commit();
      history.run(
        "A",
        (draft) => {
          draft.title = "AB";
        },
        { coalesceKey: "t" },
      );

      expect(history.entries()).toHaveLength(3);
    });
  });

  describe("jumpTo (D3)", () => {
    const three = () => {
      const ctx = setup();
      for (const title of ["A", "B", "C"]) {
        ctx.select(title);
        ctx.history.run(`Set ${title}`, (draft) => {
          draft.title = title;
        });
      }
      return ctx;
    };

    it("undoes several steps at once and restores the earliest selection", () => {
      const { history, doc, selected } = three();
      const first = history.entries()[0];

      expect(history.jumpTo(first?.id ?? "")).toBe(true);

      expect(doc().title).toBe("A");
      expect(history.state.getState().cursor).toBe(1);
      expect(selected()).toBe("B");
    });

    it("redoes several steps at once", () => {
      const { history, doc, selected } = three();
      history.jumpTo(null);
      expect(doc()).toEqual(initial);
      expect(selected()).toBe("A");

      history.jumpTo(history.entries()[2]?.id ?? "");

      expect(doc().title).toBe("C");
      expect(selected()).toBe("C");
    });

    it("returns false for an unknown entry", () => {
      const { history, doc } = three();

      expect(history.jumpTo("nope")).toBe(false);
      expect(doc().title).toBe("C");
    });

    it("does not restore selection when jumping to the current step", () => {
      const { history, select, selected } = three();
      select("other");

      history.jumpTo(history.entries()[2]?.id ?? "");

      expect(selected()).toBe("other");
    });
  });

  describe("bounded history (U7)", () => {
    it("drops the oldest entries beyond the limit", () => {
      const { history, doc } = setup({ limit: 3 });
      for (const title of ["A", "B", "C", "D", "E"]) {
        history.run(`Set ${title}`, (draft) => {
          draft.title = title;
        });
      }

      expect(history.entries().map((entry) => entry.label)).toEqual(["Set C", "Set D", "Set E"]);
      while (history.undo()) {
        // undo everything that is left
      }
      expect(doc().title).toBe("B");
    });

    /** A 100-character title. */
    const big = (letter: string) => letter.repeat(100);

    it("drops the oldest entries beyond the memory budget", () => {
      // Each entry's patches are 292 characters of JSON (forward + inverse): three fit.
      const { history, doc } = setup({ maxBytes: 900 });
      for (const letter of ["a", "b", "c", "d", "e"]) {
        history.run(`Set ${letter}`, (draft) => {
          draft.title = big(letter);
        });
      }

      expect(history.entries().map((entry) => entry.label)).toEqual(["Set c", "Set d", "Set e"]);
      while (history.undo()) {
        // undo everything that is left
      }
      expect(doc().title).toBe(big("b"));
    });

    it("keeps the current entry even when it alone is over the budget", () => {
      const { history } = setup({ maxBytes: 10 });

      history.run("Set a", (draft) => {
        draft.title = big("a");
      });

      expect(history.entries()).toHaveLength(1);
      expect(history.undo()).toBe(true);
    });

    it("measures a growing coalesced entry again", () => {
      const { history } = setup({ maxBytes: 900 });
      history.run("Set a", (draft) => {
        draft.title = big("a");
      });
      for (let i = 0; i < 10; i++) {
        history.run(
          "Edited title",
          (draft) => {
            draft.items.push({ id: `n${i}`, text: big("x") });
          },
          { coalesceKey: "items" },
        );
      }

      expect(history.entries().map((entry) => entry.label)).toEqual(["Edited title"]);
    });
  });

  it("clear forgets entries but keeps the document", () => {
    const { history, doc } = setup();
    history.run("A", (draft) => {
      draft.title = "A";
    });

    history.clear();

    expect(history.entries()).toEqual([]);
    expect(history.state.getState().canUndo).toBe(false);
    expect(doc().title).toBe("A");
  });

  it("gives every entry a unique id", () => {
    const { history } = setup();
    for (const title of ["A", "B", "C"]) {
      history.run(title, (draft) => {
        draft.title = title;
      });
    }

    expect(new Set(history.entries().map((entry) => entry.id)).size).toBe(3);
  });

  it("keeps entries JSON-serialisable (D6)", () => {
    const { history, select } = setup();
    select("a");
    history.run("Added Text", (draft) => void draft.items.push({ id: "b", text: "New" }));

    const entries = history.entries();

    expect(JSON.parse(JSON.stringify(entries))).toEqual(entries);
  });

  describe("changes from inside a change (#238)", () => {
    const reentrant = expect.objectContaining({ name: "HistoryError", code: "reentrant" });

    it("refuses a run, undo or jump from inside a recipe, changing nothing", () => {
      const { history, doc } = setup();
      history.run("First", (draft) => {
        draft.title = "One";
      });
      const before = { doc: doc(), state: history.state.getState() };

      for (const nested of [
        () => history.run("Inner", (draft) => void draft.items.pop()),
        () => history.undo(),
        () => history.jumpTo(null),
        () => history.endSession("text:a"),
      ]) {
        expect(() =>
          history.run("Outer", (draft) => {
            draft.title = "Two";
            nested();
          }),
        ).toThrow(reentrant);
      }

      expect(doc()).toBe(before.doc);
      expect(history.state.getState()).toBe(before.state);
    });

    it("leaves the document, entries and cursor as they were when a recipe throws", () => {
      const { history, doc } = setup();
      history.run("First", (draft) => {
        draft.title = "One";
      });
      const before = { doc: doc(), state: history.state.getState() };

      expect(() =>
        history.run("Broken", (draft) => {
          draft.title = "Two";
          throw new Error("broken recipe");
        }),
      ).toThrow("broken recipe");

      expect(doc()).toBe(before.doc);
      expect(history.state.getState()).toBe(before.state);
      // And the history still works.
      expect(history.undo()).toBe(true);
      expect(doc().title).toBe("Home");
    });

    it("records the step before telling a subscriber that changed it again from inside", () => {
      const { history, doc } = setup();
      const inner = vi.fn();
      const stop = history.document.subscribe(() => {
        inner(history.isChanging());
        history.run("Inner", (draft) => {
          draft.title = "Inner";
        });
      });

      expect(() =>
        history.run("Outer", (draft) => {
          draft.title = "Outer";
        }),
      ).toThrow(reentrant);
      stop();

      expect(inner).toHaveBeenCalledExactlyOnceWith(true);
      expect(doc().title).toBe("Outer");
      expect(history.entries().map((entry) => entry.label)).toEqual(["Outer"]);
      expect(history.isChanging()).toBe(false);
      history.undo();
      expect(doc().title).toBe("Home");
    });

    it("still tells the other subscribers about a change when one changed the history from inside", () => {
      const { history, doc } = setup();
      const later = vi.fn();
      const laterState = vi.fn();
      const stopNesting = history.document.subscribe(() => {
        history.run("Inner", (draft) => {
          draft.title = "Inner";
        });
      });
      const stopLater = history.document.subscribe((document) => later(document.title));
      const stopState = history.state.subscribe((state) => laterState(state.entries.length));

      expect(() =>
        history.run("Outer", (draft) => {
          draft.title = "Outer";
        }),
      ).toThrow(reentrant);
      stopNesting();
      stopLater();
      stopState();

      // The subscriber after the one that threw saw the new document, and the step was published.
      expect(later).toHaveBeenCalledExactlyOnceWith("Outer");
      expect(laterState).toHaveBeenCalledExactlyOnceWith(1);
      expect(doc().title).toBe("Outer");
    });

    it("tells every state subscriber, then rethrows the first one's error", () => {
      const { history } = setup();
      const second = vi.fn();
      const stopFirst = history.state.subscribe(() => {
        throw new Error("first");
      });
      const stopSecond = history.state.subscribe(() => {
        second();
        throw new Error("second");
      });

      expect(() =>
        history.run("Edit", (draft) => {
          draft.title = "Edited";
        }),
      ).toThrow("first");
      stopFirst();
      stopSecond();

      expect(second).toHaveBeenCalledOnce();
      expect(history.entries().map((entry) => entry.label)).toEqual(["Edit"]);
      expect(history.isChanging()).toBe(false);
    });

    it("refuses a gesture's update from inside a run, and a run from inside its update", () => {
      const { history } = setup();
      const gesture = history.begin("Drag");
      expect(() =>
        gesture.update(() => {
          history.redo();
          history.run("Inner", () => undefined);
        }),
      ).toThrow(reentrant);
      gesture.cancel();
      expect(history.entries()).toEqual([]);
    });
  });

  it("needs a selection adapter when the selection isn't null", () => {
    // @ts-expect-error: a history that records selections has to read and restore them.
    const history = createHistoryManager<Doc, string | null>({ initial });
    expect(history.entries()).toEqual([]);
  });
});

describe("finish: what every change brings with it (3.15)", () => {
  type Stamped = Doc & { changed?: string[] };
  /** A history that records, in the same step, which top-level parts each change touched. */
  function stamping() {
    const finish = vi.fn((draft: Stamped, changes: readonly { path: (string | number)[] }[]) => {
      const parts = [...new Set(changes.map((change) => String(change.path[0])))];
      draft.changed = parts.filter((part) => part !== "changed");
    });
    const history = createHistoryManager<Stamped>({ initial, finish });
    return { history, finish, doc: () => history.document.getState() };
  }

  it("changes the document in the same step, which undo and redo take with it", () => {
    const { history, doc } = stamping();

    history.run("Retitle", (draft) => {
      draft.title = "About";
    });
    expect(doc()).toMatchObject({ title: "About", changed: ["title"] });
    expect(history.entries()).toHaveLength(1);

    history.undo();
    expect(doc()).toEqual(initial);
    history.redo();
    expect(doc()).toMatchObject({ title: "About", changed: ["title"] });
  });

  it("isn't asked about a change that changed nothing", () => {
    const { history, finish } = stamping();

    history.run("Nothing", () => undefined);

    expect(finish).not.toHaveBeenCalled();
    expect(history.entries()).toHaveLength(0);
  });

  it("follows each update of a transaction, which cancelling takes back", () => {
    const { history, doc } = stamping();

    const typing = history.begin("Typing");
    typing.update((draft) => {
      const item = draft.items[0];
      if (item !== undefined) item.text = "Hi";
    });
    expect(doc().changed).toEqual(["items"]);
    typing.cancel();

    expect(doc()).toEqual(initial);
  });
});
