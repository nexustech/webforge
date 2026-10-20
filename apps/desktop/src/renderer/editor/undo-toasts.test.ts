import { createHistoryManager, type HistoryEntry } from "@webforge/history";
import { describe, expect, it, vi } from "vitest";
import type { EditKind } from "./editor-session.js";
import { installUndoToasts, UNDO_TOAST_DURATION_MS, undoEntry } from "./undo-toasts.js";

type Doc = { items: string[] };

/** A history with one step per label, each adding an item. */
function historyWith(...labels: string[]) {
  const history = createHistoryManager<Doc>({ initial: { items: [] } });
  for (const label of labels) {
    history.run(label, (draft) => {
      draft.items.push(label);
    });
  }
  const idOf = (label: string) =>
    history.state.getState().entries.find((entry) => entry.label === label)?.id ?? "";
  const items = () => history.document.getState().items;
  return { history, idOf, items };
}

describe("undoEntry (D4)", () => {
  it("undoes the step while it is still the current one", () => {
    const { history, idOf, items } = historyWith("Added Hero", "Deleted Heading");

    expect(undoEntry(history, idOf("Deleted Heading"))).toBe(true);

    expect(items()).toEqual(["Added Hero"]);
    expect(history.state.getState().cursor).toBe(1);
  });

  it("after later edits, jumps to just before the step and keeps the later ones redoable", () => {
    const { history, idOf, items } = historyWith("Added Hero", "Deleted Heading", "Edited Text");

    expect(undoEntry(history, idOf("Deleted Heading"))).toBe(true);

    expect(items()).toEqual(["Added Hero"]);
    expect(history.state.getState()).toMatchObject({ cursor: 1, canRedo: true });
  });

  it("jumps to the opened page when the step was the first one", () => {
    const { history, idOf, items } = historyWith("Deleted Heading", "Edited Text");

    expect(undoEntry(history, idOf("Deleted Heading"))).toBe(true);

    expect(items()).toEqual([]);
  });

  it("does nothing when the step is already undone or no longer exists", () => {
    const { history, idOf, items } = historyWith("Added Hero", "Deleted Heading");
    const deleted = idOf("Deleted Heading");
    history.undo();

    expect(undoEntry(history, deleted)).toBe(false);
    history.run("Edited Text", (draft) => {
      draft.items.push("Edited Text");
    });
    expect(undoEntry(history, deleted)).toBe(false);
    expect(items()).toEqual(["Added Hero", "Edited Text"]);
  });
});

describe("installUndoToasts", () => {
  function setUp() {
    const { history, idOf, items } = historyWith("Added Hero", "Deleted Heading");
    let listener: ((entry: HistoryEntry<null>, kind: EditKind) => void) | undefined;
    const stop = vi.fn();
    const session = {
      history,
      onEntryAdded: vi.fn((added: typeof listener) => {
        listener = added;
        return stop;
      }),
    };
    const show = vi.fn();
    const flush = vi.fn();
    const remove = installUndoToasts(session, show, flush);
    const entry = history.state.getState().entries.find((e) => e.id === idOf("Deleted Heading"));
    return {
      entry: entry as HistoryEntry<null>,
      items,
      listener: () => listener,
      show,
      flush,
      remove,
      stop,
    };
  }

  it("shows 'Deleted … · Undo' after a delete, and only then", () => {
    const { entry, listener, show } = setUp();

    listener()?.({ ...entry, label: "Added Hero" }, "insert");
    listener()?.(entry, "remove");

    expect(show).toHaveBeenCalledOnce();
    expect(show).toHaveBeenCalledWith("Deleted Heading", {
      duration: UNDO_TOAST_DURATION_MS,
      action: { label: "Undo", onClick: expect.any(Function) },
    });
  });

  it("ends a text edit in progress, then undoes the delete from the toast", () => {
    const { entry, items, listener, show, flush } = setUp();
    listener()?.(entry, "remove");

    show.mock.calls[0]?.[1].action.onClick();

    expect(flush).toHaveBeenCalledOnce();
    expect(items()).toEqual(["Added Hero"]);
  });

  it("stops listening when removed", () => {
    const { remove, stop } = setUp();

    remove();

    expect(stop).toHaveBeenCalledOnce();
  });
});
