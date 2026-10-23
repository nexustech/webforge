import type {
  CanvasContextMenu,
  CanvasEngine,
  ElementRequest,
  EngineEdit,
  FieldDrag,
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
  /** A click on the canvas; `adding` for a Ctrl/Cmd- or Shift-click (1.31). */
  selectFromCanvas(nodeId: string | null, adding?: boolean): void;
  /** Presses a history key in the canvas; true if the app did something with it. */
  command(command: HistoryCommand): boolean;
  /** Clicks the floating + asking for a section at `at`. */
  requestAdd(at: InsertPoint): void;
  /** Reports the canvas iframe's window (or that it went). */
  showFrame(frameWindow: Window | null): void;
  /** Right-clicks an element on the canvas (1.35). */
  rightClick(menu: CanvasContextMenu): void;
  /** Drags a field's value with a handle on the canvas (1.32). */
  dragField(drag: FieldDrag): void;
  /** A request from the selected element's quick actions (F-ED-25). */
  requestFromElement(request: ElementRequest): void;
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
  const selections = listeners<{ id: string | null; adding: boolean }>();
  const commands = new Set<HistoryCommandHandler>();
  const adds = listeners<InsertPoint>();
  const frames = listeners<Window | null>();
  const views = listeners<Viewport>();
  const drags = listeners<FieldDrag>();
  const elementRequests = listeners<ElementRequest>();
  const menus = listeners<CanvasContextMenu>();
  const applied: PageDoc[] = [];
  return {
    applied,
    mount: vi.fn(),
    loadPage: vi.fn(),
    applyChange: vi.fn(({ page }) => applied.push(page)),
    onUserEdit: edits.add,
    select: vi.fn(),
    onSelectionChange: (cb) => selections.add(({ id, adding }) => cb(id, adding)),
    showSelected: vi.fn(),
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
    setNavigation: vi.fn(),
    setViewOptions: vi.fn(),
    perform: vi.fn(() => true),
    onAddRequest: adds.add,
    onFieldDrag: drags.add,
    onElementRequest: elementRequests.add,
    onContextMenu: menus.add,
    outline: vi.fn(),
    addDragSource: vi.fn(() => () => undefined),
    setLinkPicker: vi.fn(),
    onFrameWindow: frames.add,
    setMode: vi.fn(),
    renderStatic: vi.fn(() => ""),
    destroy: vi.fn(),
    edit: (edit) =>
      edits.emit({ nodeId: null, componentType: null, field: null, selection: null, ...edit }),
    selectFromCanvas: (id, adding = false) => selections.emit({ id, adding }),
    command: (command) => [...commands].some((handler) => handler(command) === true),
    requestAdd: adds.emit,
    showFrame: frames.emit,
    switchView: views.emit,
    dragField: drags.emit,
    requestFromElement: elementRequests.emit,
    rightClick: menus.emit,
  };
}
