import { describe, expect, it } from "vitest";
import {
  APPEARANCE_FIELDS,
  APPEARANCE_TEXT_FIELD_NAMES,
  DIALOG_ELEMENT_FIELDS,
  DIALOG_FIELDS,
  DIALOG_TITLE_FIELDS,
} from "./appearance.js";
import { siteLibrary } from "./catalogue/index.js";
import {
  APPEARANCE_TEXT_FIELDS,
  CATALOGUE,
  catalogueFileSchema,
  catalogueSchema,
  fieldValueSchema,
  hiddenFieldsOf,
  hideableFieldsOf,
} from "./catalogue-data.js";
import type { ComponentDef } from "./library.js";

/** The styling fields every section and element has: the Appearance group's and the dialog's. */
const STYLING = { ...APPEARANCE_FIELDS, ...DIALOG_FIELDS };

/**
 * The library as data: every component without what only rendering needs (its render, frame and
 * behaviours) and without functions (a field's `unavailable`), as JSON keeps it; the styling
 * fields every component has once, each component marked as having them (2.22b, 3.13b).
 */
/**
 * `def`'s text style as data (#670): the one it has, or, when a select field changes it, its
 * style for each of that field's values.
 */
function textStyleAsData(def: ComponentDef): unknown {
  const styleOf = def.textStyle as ((values: Record<string, unknown>) => unknown) | undefined;
  if (styleOf === undefined) return undefined;
  const base = styleOf({ ...def.defaults });
  for (const [name, field] of Object.entries(def.fields)) {
    if (field.kind !== "select") continue;
    const styles = Object.fromEntries(
      field.options.map((option) => [
        option.value,
        styleOf({ ...def.defaults, [name]: option.value }),
      ]),
    );
    if (Object.values(styles).some((style) => style !== base)) return { field: name, styles };
  }
  return base;
}

function libraryAsData(): unknown {
  const group = Object.keys(STYLING);
  const entries = Object.entries(siteLibrary.components).map(([type, def]) => {
    const {
      label,
      place,
      category,
      advancedOnly,
      framed,
      presets,
      fields,
      defaults,
      variantHides,
      graphic,
    } = def;
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
    // The dialog's fields for elements, or for titled sections, written once too (3.13b).
    const deeper = Object.hasOwn(fields, "lookPadding")
      ? "element"
      : Object.hasOwn(fields, "lookTitleColor")
        ? "titled"
        : undefined;
    const shared =
      deeper === "element" ? DIALOG_ELEMENT_FIELDS : deeper === "titled" ? DIALOG_TITLE_FIELDS : {};
    const own = Object.fromEntries(
      Object.entries(fields).filter(
        ([name]) => !has.includes(name) && !Object.hasOwn(shared, name),
      ),
    );
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
        deeper,
        fields: own,
        defaults,
        variantHides,
        graphic,
        textStyle: textStyleAsData(def),
      },
    ];
  });
  // Through JSON: functions and undefined go, as they would from the file.
  return JSON.parse(
    JSON.stringify({
      appearance: STYLING,
      element: DIALOG_ELEMENT_FIELDS,
      titled: DIALOG_TITLE_FIELDS,
      components: Object.fromEntries(entries),
    }),
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

  it("knows each field that can be hidden, so Site Check works out only those (#670)", () => {
    const image = { mediaId: "loaves" };
    for (const [type, component] of Object.entries(CATALOGUE)) {
      const hideable = hideableFieldsOf(component);
      // Each layout, with nothing else set, and with what reveals the fields hidden by values.
      const layouts = [undefined, ...Object.keys(component.variantHides ?? {})];
      for (const variant of layouts) {
        for (const extra of [{}, { lookBorder: "thin", backgroundImage: image }]) {
          const values = { ...component.defaults, ...extra, variant };
          for (const name of hiddenFieldsOf(component, values)) {
            expect(hideable.has(name), `${type}.${name}`).toBe(true);
          }
        }
      }
    }
    // A section's overlay is hideable; a Heading's colour never is.
    expect(hideableFieldsOf(CATALOGUE.Section ?? { fields: {} }).has("overlay")).toBe(true);
    expect(hideableFieldsOf(CATALOGUE.Heading ?? { fields: {} }).has("color")).toBe(false);
  });

  it("marks the components whose colour colours a drawing: graphics need 3:1 (#670)", () => {
    const graphic = Object.entries(CATALOGUE)
      .filter(([, component]) => component.graphic === true)
      .map(([type]) => type);
    expect(graphic.sort()).toEqual(["Icon", "SocialLinks"]);
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
