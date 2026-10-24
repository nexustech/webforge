import { describe, expect, it, vi } from "vitest";
import { createContextualToolbars } from "./contextual-toolbars.js";

const toolbar = (id: string, types: readonly string[]) => ({
  id,
  types,
  component: () => null,
});

describe("contextual toolbars (SP-4)", () => {
  it("finds an element type's toolbar, the first registered for it", () => {
    const toolbars = createContextualToolbars();
    const heading = toolbar("heading", ["Heading"]);
    toolbars.register(heading);
    toolbars.register(toolbar("also", ["Heading", "List"]));

    expect(toolbars.forType("Heading")).toBe(heading);
    expect(toolbars.forType("List")?.id).toBe("also");
    expect(toolbars.forType("Text")).toBeUndefined();
  });

  it("takes a toolbar away, tells listeners, and refuses an id twice", () => {
    const toolbars = createContextualToolbars();
    const listener = vi.fn();
    toolbars.subscribe(listener);
    const remove = toolbars.register(toolbar("heading", ["Heading"]));

    expect(() => toolbars.register(toolbar("heading", ["Text"]))).toThrow(/already registered/);
    remove();
    expect(toolbars.forType("Heading")).toBeUndefined();
    expect(toolbars.list()).toEqual([]);
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
