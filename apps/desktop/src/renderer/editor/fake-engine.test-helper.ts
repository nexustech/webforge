import type {
  CanvasEngine,
  EngineEdit,
  HistoryCommand,
  HistoryCommandHandler,
  InsertPoint,
  Unsubscribe,
  Viewport,
} from "@webforge/engine";
import type { PageDoc } from "@webforge/model";
import { vi } from "vitest";

/** A {@link CanvasEngine} driven by the test: it records calls and emits what the test says. */
export type FakeEngine = CanvasEngine & {
  edit(edit: Partial<EngineEdit> & Pick<EngineEdit, "kind" | "page">): void;
  selectFromCanvas(nodeId: string | null): void;
  /** Presses a history key in the canvas; true if the app did something with it. */
  command(command: HistoryCommand): boolean;
  /** Clicks the floating + asking for a section at `at`. */
  requestAdd(at: InsertPoint): void;
  /** Reports the canvas iframe's window (or that it went). */
  showFrame(frameWindow: Window | null): void;
  /** Switches the device view with the canvas's own controls. */
  switchView(viewport: Viewport): void;
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
  const commands = new Set<HistoryCommandHandler>();
  const adds = listeners<InsertPoint>();
  const frames = listeners<Window | null>();
  const views = listeners<Viewport>();
  const applied: PageDoc[] = [];
  return {
    applied,
    mount: vi.fn(),
    loadPage: vi.fn(),
    applyChange: vi.fn(({ page }) => applied.push(page)),
    onUserEdit: edits.add,
    select: vi.fn(),
    onSelectionChange: selections.add,
    onHistoryCommand: (handler) => {
      commands.add(handler);
      return () => commands.delete(handler);
    },
    setViewport: vi.fn(),
    onViewportChange: views.add,
    setZoom: vi.fn(),
    onCanvasSize: () => () => undefined,
    setSiteCss: vi.fn(),
    setImages: vi.fn(),
    setSettings: vi.fn(),
    perform: vi.fn(() => true),
    onAddRequest: adds.add,
    addDragSource: vi.fn(() => () => undefined),
    onFrameWindow: frames.add,
    setMode: vi.fn(),
    renderStatic: vi.fn(() => ""),
    destroy: vi.fn(),
    edit: (edit) =>
      edits.emit({ nodeId: null, componentType: null, field: null, selection: null, ...edit }),
    selectFromCanvas: selections.emit,
    command: (command) => [...commands].some((handler) => handler(command) === true),
    requestAdd: adds.emit,
    showFrame: frames.emit,
    switchView: views.emit,
  };
}
