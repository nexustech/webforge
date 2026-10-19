import type { CanvasEngine, EngineEdit, HistoryCommand, Unsubscribe } from "@webforge/engine";
import type { PageDoc } from "@webforge/model";
import { vi } from "vitest";

/** A {@link CanvasEngine} driven by the test: it records calls and emits what the test says. */
export type FakeEngine = CanvasEngine & {
  edit(edit: Partial<EngineEdit> & Pick<EngineEdit, "kind" | "page">): void;
  selectFromCanvas(nodeId: string | null): void;
  command(command: HistoryCommand): void;
  readonly applied: PageDoc[];
};

function listeners<T>() {
  const set = new Set<(value: T) => void>();
  return {
    add: (listener: (value: T) => void): Unsubscribe => {
      set.add(listener);
      return () => set.delete(listener);
    },
    emit: (value: T) => {
      for (const listener of set) listener(value);
    },
  };
}

export function createFakeEngine(): FakeEngine {
  const edits = listeners<EngineEdit>();
  const selections = listeners<string | null>();
  const commands = listeners<HistoryCommand>();
  const applied: PageDoc[] = [];
  return {
    applied,
    mount: vi.fn(),
    loadPage: vi.fn(),
    applyChange: vi.fn(({ page }) => applied.push(page)),
    onUserEdit: edits.add,
    select: vi.fn(),
    onSelectionChange: selections.add,
    onHistoryCommand: commands.add,
    setViewport: vi.fn(),
    setMode: vi.fn(),
    renderStatic: vi.fn(() => ""),
    destroy: vi.fn(),
    edit: (edit) =>
      edits.emit({ nodeId: null, componentType: null, field: null, selection: null, ...edit }),
    selectFromCanvas: selections.emit,
    command: commands.emit,
  };
}
