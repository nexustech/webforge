import { describe, expect, it } from "vitest";
import { EDITOR_AREAS, WINDOW_AREAS } from "../areas.js";
import { type Area, connectAreas } from "./areas.js";

describe("connectAreas (2.20, B1)", () => {
  it("registers the areas in order, and removes them in the opposite order", () => {
    const order: string[] = [];
    const area = (id: string): Area<string[]> => ({
      id,
      register: (log) => {
        log.push(`register ${id}`);
        return () => log.push(`remove ${id}`);
      },
    });

    const remove = connectAreas([area("a"), area("b")], order);
    remove();

    expect(order).toEqual(["register a", "register b", "remove b", "remove a"]);
  });
});

describe("the composition root (2.20, B1)", () => {
  it("names each area once", () => {
    const ids = [...EDITOR_AREAS, ...WINDOW_AREAS].map((area) => area.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it("registers the Edit menu's commands in their order: Cut first, Select similar last", () => {
    // The Edit menu lists commands as they register (1.25, 1.37, 1.29, 1.30).
    const ids = EDITOR_AREAS.map((area) => area.id);

    expect(ids.indexOf("clipboardCommands")).toBeLessThan(ids.indexOf("styleCommands"));
    expect(ids.indexOf("styleCommands")).toBeLessThan(ids.indexOf("canvasCommands"));
    expect(ids.indexOf("canvasCommands")).toBeLessThan(ids.indexOf("sharedSectionCommands"));
    expect(ids.indexOf("sharedSectionCommands")).toBeLessThan(ids.indexOf("elementCommands"));
  });
});
