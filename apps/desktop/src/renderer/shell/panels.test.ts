import { describe, expect, it, vi } from "vitest";
import { createPanelRegistry, type Panel, panelsInSlot } from "./panels.js";

const component = () => null;
const panel = (id: string, changes: Partial<Panel> = {}): Panel => ({
  id,
  slot: "left.top",
  title: id,
  component,
  ...changes,
});

describe("createPanelRegistry", () => {
  it("registers and removes panels, telling subscribers", () => {
    const registry = createPanelRegistry();
    const listener = vi.fn();
    registry.subscribe(listener);

    const remove = registry.register(panel("add"));
    expect(registry.list().map((entry) => entry.id)).toEqual(["add"]);
    remove();
    remove();

    expect(registry.list()).toEqual([]);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("refuses two panels with the same id, and ignores a stale removal", () => {
    const registry = createPanelRegistry();
    const removeFirst = registry.register(panel("add"));
    expect(() => registry.register(panel("add"))).toThrow(/already/);

    removeFirst();
    registry.register(panel("add", { title: "Second" }));
    removeFirst();

    expect(registry.list()[0]?.title).toBe("Second");
  });

  it("stops telling a listener once it unsubscribes", () => {
    const registry = createPanelRegistry();
    const listener = vi.fn();
    registry.subscribe(listener)();

    registry.register(panel("add"));

    expect(listener).not.toHaveBeenCalled();
  });
});

describe("panelsInSlot", () => {
  const panels = [
    panel("layers", { slot: "left.bottom", advancedOnly: true, order: 1 }),
    panel("history", { slot: "left.bottom", order: 2 }),
    panel("add"),
    panel("checks", { slot: "left.bottom", order: 2 }),
  ];

  it("gives a slot's panels in tab order, keeping registration order for ties", () => {
    expect(panelsInSlot(panels, "left.bottom", "advanced").map((entry) => entry.id)).toEqual([
      "layers",
      "history",
      "checks",
    ]);
  });

  it("hides Advanced-only panels in Simple mode", () => {
    expect(panelsInSlot(panels, "left.bottom", "simple").map((entry) => entry.id)).toEqual([
      "history",
      "checks",
    ]);
    expect(panelsInSlot(panels, "drawer", "advanced")).toEqual([]);
  });
});
