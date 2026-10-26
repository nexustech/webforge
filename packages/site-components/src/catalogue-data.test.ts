import { describe, expect, it } from "vitest";
import { siteLibrary } from "./catalogue/index.js";
import { CATALOGUE, catalogueSchema, fieldValueSchema } from "./catalogue-data.js";

/**
 * The library as data: every component without what only rendering needs (its render, frame and
 * behaviours) and without functions (a field's `unavailable`), as JSON keeps it.
 */
function libraryAsData(): unknown {
  const entries = Object.entries(siteLibrary.components).map(([type, def]) => {
    const { label, place, category, advancedOnly, framed, presets, fields, defaults } = def;
    return [
      type,
      {
        label,
        place: place ?? "element",
        category,
        advancedOnly,
        framed,
        presets,
        fields,
        defaults,
      },
    ];
  });
  // Through JSON: functions and undefined go, as they would from the file.
  return JSON.parse(JSON.stringify(Object.fromEntries(entries)));
}

describe("the catalogue as data (4.8)", () => {
  it("is the library's: after changing a component, run `pnpm catalogue-data`", async () => {
    const data = libraryAsData();
    expect(catalogueSchema.safeParse(data).success).toBe(true);
    await expect(`${JSON.stringify(data, null, 2)}\n`).toMatchFileSnapshot("catalogue-data.json");
  });

  it("checks a field's value by its kind", () => {
    const hero = CATALOGUE.Hero;
    if (hero === undefined) throw new Error("No Hero");
    const field = (name: string) => {
      const found = hero.fields[name];
      if (found === undefined) throw new Error(`No ${name}`);
      return fieldValueSchema(found);
    };
    expect(field("title").safeParse("Fresh bread").success).toBe(true);
    expect(field("title").safeParse(3).success).toBe(false);
    expect(field("variant").safeParse("split").success).toBe(true);
    expect(field("variant").safeParse("sideways").success).toBe(false);
    expect(
      field("buttonLink").safeParse({ kind: "url", href: "https://example.com" }).success,
    ).toBe(true);
    expect(
      field("buttonLink").safeParse({ kind: "url", href: "javascript:alert(1)" }).success,
    ).toBe(false);
  });

  it("never lets Custom Code be set", () => {
    const code = Object.values(CATALOGUE).flatMap((component) =>
      Object.values(component.fields).filter((field) => field.kind === "code"),
    );
    expect(code.length).toBeGreaterThan(0);
    for (const field of code)
      expect(fieldValueSchema(field).safeParse("<p></p>").success).toBe(false);
  });
});
