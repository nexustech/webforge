import { describe, expect, it } from "vitest";
import type { PageId } from "./ids.js";
import { entriesOf, isKeyOf, keysOf } from "./records.js";

const home = "home" as PageId;
const pages: Record<PageId, string> = { [home]: "Home" };
// An object with a key on its prototype, which only the record's own keys must leave out.
const withInherited = Object.assign(Object.create({ inherited: "no" }) as object, pages) as Record<
  PageId,
  string
>;

describe("keysOf, entriesOf and isKeyOf (#989, R10)", () => {
  it("give a record's own keys and entries, typed as its keys", () => {
    const keys: PageId[] = keysOf(withInherited);
    const entries: [PageId, string][] = entriesOf(withInherited);

    expect(keys).toEqual(["home"]);
    expect(entries).toEqual([["home", "Home"]]);
    expect(keysOf({})).toEqual([]);
  });

  it("says a key is the record's own, never one every object has or one it inherits", () => {
    expect(isKeyOf(pages, "home")).toBe(true);
    expect(isKeyOf(pages, "about")).toBe(false);
    expect(isKeyOf(pages, "constructor")).toBe(false);
    expect(isKeyOf(pages, "__proto__")).toBe(false);
    expect(isKeyOf(withInherited, "inherited")).toBe(false);
  });
});
