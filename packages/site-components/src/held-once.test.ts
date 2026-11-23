import type { NodeDoc } from "@webforge/model";
import { describe, expect, it } from "vitest";
import { siteLibrary } from "./catalogue/index.js";
import { secondOfOne } from "./held-once.js";
import { overfillsSlots } from "./library.js";

const fieldsOf = (type: string) => siteLibrary.components[type]?.fields;
const menu = (id: string): NodeDoc => ({ type: "MenuLinks", props: { id } });
const text = (id: string): NodeDoc => ({ type: "Text", props: { id, text: "<p>Hi</p>" } });
const column = (id: string, content: readonly NodeDoc[]): NodeDoc => ({
  type: "FooterColumn",
  props: { id, content: [...content] },
});
const footer = (...columns: readonly NodeDoc[]): NodeDoc => ({
  type: "Footer",
  props: { id: "footer", text: "Thanks.", columns: [...columns] },
});

describe("one Menu links per Footer (5.39)", () => {
  it("refuses a second Menu links in any column, or in a column that brings one", () => {
    const one = [footer(column("a", [menu("m")]), column("b", []))];
    expect(secondOfOne(fieldsOf, one, "b", menu("new"))).toBe("MenuLinks");
    expect(secondOfOne(fieldsOf, one, "footer", column("c", [menu("new")]))).toBe("MenuLinks");
    // Anything else, and a first one, go.
    expect(secondOfOne(fieldsOf, one, "b", text("t"))).toBeUndefined();
    expect(secondOfOne(fieldsOf, [footer(column("a", []))], "a", menu("new"))).toBeUndefined();
  });

  it("lets the one there move, alone or in its column", () => {
    const one = [footer(column("a", [menu("m")]), column("b", []))];
    expect(secondOfOne(fieldsOf, one, "b", menu("m"), "m")).toBeUndefined();
    expect(secondOfOne(fieldsOf, one, "footer", column("a", [menu("m")]), "a")).toBeUndefined();
  });

  it("refuses a paste, drop or duplicate that makes a second", () => {
    const before = [footer(column("a", [menu("m")]), column("b", []))];
    const after = [footer(column("a", [menu("m")]), column("b", [menu("copy")]))];
    expect(overfillsSlots(siteLibrary, before, after)).toBe(true);
    expect(overfillsSlots(siteLibrary, before, before)).toBe(false);
  });
});
