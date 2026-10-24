import { createHistoryManager, type HistoryEntry } from "@webforge/history";
import { describe, expect, it, vi } from "vitest";
import type { EditKind } from "./editor-session.js";
import { undoEntry } from "./undo-entry.js";
import { installUndoToasts, UNDO_TOAST_DURATION_MS } from "./undo-toasts.js";

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

  it("reports that nothing changed while a gesture is in progress", () => {
    const { history, idOf, items } = historyWith("Added Hero", "Deleted Heading");
    const gesture = history.begin("Changed Section padding");

    expect(undoEntry(history, idOf("Deleted Heading"))).toBe(false);

    gesture.cancel();
    expect(items()).toEqual(["Added Hero", "Deleted Heading"]);
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
    const show = vi.fn(() => "toast-1");
    const dismiss = vi.fn();
    const flush = vi.fn();
    const remove = installUndoToasts(session, { show, dismiss }, flush);
    const entry = history.state.getState().entries.find((e) => e.id === idOf("Deleted Heading"));
    return {
      entry: entry as HistoryEntry<null>,
      items,
      listener: () => listener,
      history,
      show,
      dismiss,
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
      onDismiss: expect.any(Function),
      onAutoClose: expect.any(Function),
    });
  });

  it("ends a text edit in progress, then undoes the delete from the toast", () => {
    const { entry, items, listener, show, flush } = setUp();
    listener()?.(entry, "remove");

    (
      show.mock.calls[0] as unknown as [string, { action: { onClick(): void } }]
    )[1].action.onClick();

    expect(flush).toHaveBeenCalledOnce();
    expect(items()).toEqual(["Added Hero"]);
  });

  it("closes the toast once its step is undone some other way", () => {
    const { entry, history, listener, dismiss } = setUp();
    listener()?.(entry, "remove");

    history.run("Edited Text", (draft) => {
      draft.items.push("Edited Text");
    });
    expect(dismiss).not.toHaveBeenCalled();
    history.jumpTo(null);

    expect(dismiss).toHaveBeenCalledWith("toast-1");
    expect(dismiss).toHaveBeenCalledOnce();
    history.redo();
    history.undo();
    expect(dismiss).toHaveBeenCalledOnce();
  });

  it("stops watching a toast that closed on its own", () => {
    const { entry, history, listener, show, dismiss } = setUp();
    listener()?.(entry, "remove");

    (show.mock.calls[0] as unknown as [string, { onAutoClose(): void }])[1].onAutoClose();
    history.undo();

    expect(dismiss).not.toHaveBeenCalled();
  });

  it("stops listening when removed", () => {
    const { remove, stop } = setUp();

    remove();

    expect(stop).toHaveBeenCalledOnce();
  });
});
