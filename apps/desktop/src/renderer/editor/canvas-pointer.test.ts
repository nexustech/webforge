import { describe, expect, it, vi } from "vitest";
import { createCanvasPointer } from "./canvas-pointer.js";

describe("createCanvasPointer (SP-8, SP-10)", () => {
  it("points on the connected engine, and clears what it showed when the engine goes", () => {
    const pointer = createCanvasPointer();
    // Nothing connected: nothing to show it on.
    pointer.outline("a");

    const engine = { outline: vi.fn(), markDrop: vi.fn() };
    const disconnect = pointer.connect(engine);
    pointer.outline("b");
    pointer.markDrop({ nodeId: "b", place: "after", name: "Text" });
    expect(engine.outline).toHaveBeenCalledWith("b");
    expect(engine.markDrop).toHaveBeenCalledWith({ nodeId: "b", place: "after", name: "Text" });

    disconnect();
    expect(engine.outline).toHaveBeenLastCalledWith(null);
    expect(engine.markDrop).toHaveBeenLastCalledWith(null);
    pointer.outline("c");
    expect(engine.outline).not.toHaveBeenCalledWith("c");
  });

  it("clears only what it showed itself, leaving a breadcrumb's outline (#421 review)", () => {
    const pointer = createCanvasPointer();
    const engine = { outline: vi.fn(), markDrop: vi.fn() };
    const disconnect = pointer.connect(engine);

    // Nothing outlined or marked through it: nothing to clear on the engine.
    pointer.outline(null);
    pointer.markDrop(null);
    disconnect();
    expect(engine.outline).not.toHaveBeenCalled();
    expect(engine.markDrop).not.toHaveBeenCalled();
  });

  it("leaves a newer engine connected when an older one disconnects late", () => {
    const pointer = createCanvasPointer();
    const older = { outline: vi.fn(), markDrop: vi.fn() };
    const newer = { outline: vi.fn(), markDrop: vi.fn() };
    const disconnectOlder = pointer.connect(older);
    pointer.connect(newer);

    disconnectOlder();
    pointer.outline("a");
    expect(newer.outline).toHaveBeenCalledWith("a");
    expect(older.outline).not.toHaveBeenCalled();
  });
});
