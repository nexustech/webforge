// @vitest-environment happy-dom
import type { HistoryEntry, HistoryState } from "@webforge/history";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { UndoHistoryPanel } from "./UndoHistoryPanel.js";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const entry = (id: string, label: string): HistoryEntry<string | null> => ({
  id,
  label,
  forward: [],
  inverse: [],
  coalesceKey: null,
  selectionBefore: null,
  selectionAfter: null,
  createdAt: 0,
  updatedAt: 0,
});

const state = (cursor: number): HistoryState<string | null> => ({
  entries: [entry("h1", "Added Heading"), entry("h2", "Moved Heading")],
  cursor,
  canUndo: cursor > 0,
  canRedo: cursor < 2,
  transaction: null,
});

async function render(cursor: number) {
  const container = document.createElement("div");
  const history = { jumpTo: vi.fn(() => true) };
  await act(async () =>
    createRoot(container).render(<UndoHistoryPanel history={history} state={state(cursor)} />),
  );
  const steps = [...container.querySelectorAll<HTMLButtonElement>(".undo-history__step")];
  return { history, steps, container };
}

describe("UndoHistoryPanel", () => {
  it("lists steps newest first, ending with the opened page, in a list named Undo History", async () => {
    const { steps, container } = await render(2);

    expect(container.querySelector("ol")?.getAttribute("aria-label")).toBe("Undo History");
    expect(steps.map((step) => step.textContent)).toEqual([
      "Moved Heading",
      "Added Heading",
      "Opened page",
    ]);
  });

  it("marks the current step and greys out undone ones", async () => {
    const { steps } = await render(1);

    expect(steps.map((step) => step.dataset.state)).toEqual(["undone", "current", "done"]);
    expect(steps[1]?.getAttribute("aria-current")).toBe("step");
    expect(steps[0]?.hasAttribute("aria-current")).toBe(false);
  });

  it("jumps to a step when it is clicked", async () => {
    const { history, steps } = await render(2);

    steps[2]?.click();
    steps[1]?.click();

    expect(history.jumpTo.mock.calls).toEqual([[null], ["h1"]]);
  });
});
