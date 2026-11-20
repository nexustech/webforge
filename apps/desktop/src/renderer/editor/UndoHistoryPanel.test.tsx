// @vitest-environment happy-dom
import type { HistoryEntry, HistoryState } from "@webforge/history";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { UndoHistoryPanel } from "./UndoHistoryPanel.js";

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
  document.body.replaceChildren();
  const container = document.body.appendChild(document.createElement("div"));
  const history = { jumpTo: vi.fn(() => true) };
  const root = createRoot(container);
  /** Draws the panel at `at`, as an undo, a redo or a jump does. */
  const at = async (to: number) =>
    act(async () => root.render(<UndoHistoryPanel history={history} state={state(to)} />));
  await at(cursor);
  const steps = [...container.querySelectorAll<HTMLButtonElement>(".undo-history__step")];
  return { history, steps, container, at };
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

  it("is one Tab stop, the current step, with arrows, Home and End between steps (#1179)", async () => {
    const { steps } = await render(1);
    expect(steps.map((step) => step.tabIndex)).toEqual([-1, 0, -1]);

    const press = async (key: string) =>
      act(async () => {
        document.activeElement?.dispatchEvent(
          new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }),
        );
      });
    await act(async () => steps[1]?.focus());
    await press("ArrowDown");
    expect(document.activeElement).toBe(steps[2]);
    // The step last focused is now the Tab stop.
    expect(steps.map((step) => step.tabIndex)).toEqual([-1, -1, 0]);
    await press("ArrowDown");
    expect(document.activeElement).toBe(steps[2]);
    await press("Home");
    expect(document.activeElement).toBe(steps[0]);
    await press("ArrowUp");
    expect(document.activeElement).toBe(steps[0]);
    await press("End");
    expect(document.activeElement).toBe(steps[2]);
    await press("ArrowUp");
    expect(document.activeElement).toBe(steps[1]);
  });

  it("goes back to the step you're at once it changes, not the one focused before (#1179)", async () => {
    const { steps, at } = await render(1);
    await act(async () => steps[2]?.focus());
    expect(steps.map((step) => step.tabIndex)).toEqual([-1, -1, 0]);

    // Focus left the list, then a redo: Tab comes back to the ticked step.
    await act(async () => steps[2]?.blur());
    await at(2);
    expect(steps.map((step) => step.tabIndex)).toEqual([0, -1, -1]);
  });
});
