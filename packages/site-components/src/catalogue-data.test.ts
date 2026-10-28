import { describe, expect, it } from "vitest";
import { APPEARANCE_FIELDS, APPEARANCE_TEXT_FIELD_NAMES, DIALOG_FIELDS } from "./appearance.js";
import { siteLibrary } from "./catalogue/index.js";
import {
  APPEARANCE_TEXT_FIELDS,
  CATALOGUE,
  catalogueFileSchema,
  catalogueSchema,
  fieldValueSchema,
} from "./catalogue-data.js";

/** The styling fields every section and element has: the Appearance group's and the dialog's. */
const STYLING = { ...APPEARANCE_FIELDS, ...DIALOG_FIELDS };

/**
 * The library as data: every component without what only rendering needs (its render, frame and
 * behaviours) and without functions (a field's `unavailable`), as JSON keeps it; the styling
 * fields every component has once, each component marked as having them (2.22b, 3.13b).
 */
function libraryAsData(): unknown {
  const group = Object.keys(STYLING);
  const entries = Object.entries(siteLibrary.components).map(([type, def]) => {
    const { label, place, category, advancedOnly, framed, presets, fields, defaults } = def;
    const has = group.filter((name) => Object.hasOwn(fields, name));
    const appearance =
      has.length === 0
        ? undefined
        : has.length === group.length
          ? "all"
          : // Without the Text controls only: anything else isn't the group.
            has.length === group.length - APPEARANCE_TEXT_FIELD_NAMES.length
            ? "noText"
            : "partial";
    const own = Object.fromEntries(Object.entries(fields).filter(([name]) => !has.includes(name)));
    return [
      type,
      {
        label,
        place: place ?? "element",
        category,
        advancedOnly,
        framed,
        presets,
        appearance,
        fields: own,
        defaults,
      },
    ];
  });
  // Through JSON: functions and undefined go, as they would from the file.
  return JSON.parse(
    JSON.stringify({ appearance: STYLING, components: Object.fromEntries(entries) }),
  );
}

describe("the catalogue as data (4.8)", () => {
  it("is the library's: after changing a component, run `pnpm catalogue-data`", async () => {
    const data = libraryAsData();
    expect(catalogueFileSchema.safeParse(data).success).toBe(true);
    await expect(`${JSON.stringify(data, null, 2)}\n`).toMatchFileSnapshot("catalogue-data.json");
  });

  it("puts the Appearance group back in each component, as the library has it (2.22b)", () => {
    expect(APPEARANCE_TEXT_FIELDS).toEqual(APPEARANCE_TEXT_FIELD_NAMES);
    const library = JSON.parse(
      JSON.stringify(
        Object.fromEntries(
          Object.entries(siteLibrary.components).map(([type, def]) => [
            type,
            Object.keys(def.fields),
          ]),
        ),
      ),
    ) as Record<string, string[]>;
    for (const [type, component] of Object.entries(CATALOGUE)) {
      expect(Object.keys(component.fields), type).toEqual(library[type]);
    }
    expect(catalogueSchema.safeParse(CATALOGUE).success).toBe(true);
    // A command can set the group on a Hero, and not something it doesn't offer.
    const underline = CATALOGUE.Hero?.fields.lookUnderline;
    if (underline === undefined) throw new Error("No Hero underline");
    expect(fieldValueSchema(underline).safeParse(true).success).toBe(true);
    expect(fieldValueSchema(underline).safeParse("yes").success).toBe(false);
    expect(CATALOGUE.Section?.fields.lookUnderline).toBeUndefined();
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
