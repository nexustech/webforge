import type { Responsive } from "@webforge/model";
import { isValidElement, type ReactNode } from "react";
import { describe, expect, expectTypeOf, it } from "vitest";
import { BEHAVIOUR_SCRIPTS } from "./behaviours.js";
import { siteLibrary } from "./catalogue/index.js";
import { type ComponentSpec, createLibrary, defineComponent } from "./define.js";
import { type ComponentDef, EDITOR_RENDER_CONTEXT } from "./library.js";
import type { FieldDef } from "./schema.js";

/**
 * A spec typed loosely, as a file's would be: these tests give `defineComponent` what its types
 * refuse, to check that it refuses it at run time too.
 */
type LooseSpec = ComponentSpec<Readonly<Record<string, FieldDef>>, string>;

/** A plain component to vary in each test. */
const base: LooseSpec = {
  label: "Card",
  fields: {
    title: { kind: "text", label: "Title" },
    size: {
      kind: "select",
      label: "Size",
      responsive: true,
      options: [
        { label: "Small", value: "small" },
        { label: "Large", value: "large" },
      ],
    },
  },
  defaults: { title: "Hello", size: "small" },
  render: () => null,
};

describe("defineComponent (2.5)", () => {
  it("accepts a component that follows the conventions, as it is", () => {
    const def = defineComponent(base);

    expect(def.fields).toBe(base.fields);
    expect(def.defaults).toBe(base.defaults);
    expect(def.label).toBe("Card");
  });

  it.each([
    ["no display name (D2)", { label: "  " }, "A component needs a display name"],
    [
      "a free value as a style (C4)",
      { fields: { ...base.fields, colour: { kind: "text", label: "Colour", group: "style" } } },
      `'Card' styles with "colour", a text field`,
    ],
    [
      "a free value per device (F-ED-4)",
      { fields: { ...base.fields, title: { kind: "text", label: "Title", responsive: true } } },
      `'Card' sets "title", a text field, per device`,
    ],
    [
      "a default that isn't a choice",
      { defaults: { ...base.defaults, size: "huge" } },
      `'Card' defaults "size" to "huge"`,
    ],
    [
      "the same choice twice",
      {
        fields: {
          ...base.fields,
          size: {
            kind: "select",
            label: "Size",
            options: [
              { label: "Small", value: "small" },
              { label: "Tiny", value: "small" },
            ],
          },
        },
      },
      `'Card' offers a choice twice for "size"`,
    ],
    [
      "no choices",
      {
        fields: { ...base.fields, size: { kind: "slider", label: "Size", steps: [] } },
        defaults: { title: "Hello" },
      },
      `'Card' offers no choices for "size"`,
    ],
    [
      "a default for no field",
      { defaults: { ...base.defaults, colour: "red" } },
      `'Card' has a default for "colour"`,
    ],
    [
      "a behaviour that isn't in behaviours/",
      { behaviours: ["carousel"] },
      `'Card' needs the behaviour "carousel"`,
    ],
  ] satisfies [string, Partial<LooseSpec>, string][])("refuses %s", (_name, change, message) => {
    expect(() => defineComponent({ ...base, ...change })).toThrow(message);
  });

  it("accepts a default set per device, each device's value one of the choices", () => {
    const perDevice = { $responsive: { desktop: "large", mobile: "small" } };

    // Loose fields don't say `size` is set per device: its defaults are given as a file's would be.
    const withSize = (size: unknown) => ({ ...base.defaults, size }) as LooseSpec["defaults"];

    expect(defineComponent({ ...base, defaults: withSize(perDevice) }).defaults.size).toBe(
      perDevice,
    );
    expect(() =>
      defineComponent({
        ...base,
        defaults: withSize({ $responsive: { desktop: "large", mobile: "huge" } }),
      }),
    ).toThrow(`'Card' defaults "size" to "huge"`);
  });

  it("adds layout variants as a Style choice that defaults to the first", () => {
    const def = defineComponent({
      ...base,
      variants: [
        { label: "Image left", value: "left" },
        { label: "Image right", value: "right" },
      ],
    });

    expect(def.fields.variant).toEqual({
      kind: "select",
      group: "style",
      label: "Layout",
      options: [
        { label: "Image left", value: "left" },
        { label: "Image right", value: "right" },
      ],
    });
    expect(def.defaults.variant).toBe("left");
    expect(() => defineComponent({ ...base, variants: [] })).toThrow("'Card' has no variants");
    expect(() =>
      defineComponent({
        ...base,
        fields: { ...base.fields, variant: { kind: "toggle", label: "Variant" } },
        variants: [{ label: "A", value: "a" }],
      }),
    ).toThrow(`'Card' has variants and a field named "variant"`);
  });

  it("knows the behaviours of behaviours/, by file name", () => {
    expect(Object.keys(BEHAVIOUR_SCRIPTS)).toContain("menu");
    expect(BEHAVIOUR_SCRIPTS.menu).toContain("Header menu on small screens");
    expect(defineComponent({ ...base, behaviours: ["menu"] }).behaviours).toEqual(["menu"]);
  });
});

describe("defineComponent's types (R7)", () => {
  const fields = {
    title: { kind: "text", label: "Title", inline: true },
    note: { kind: "text", label: "Note" },
    size: {
      kind: "select",
      label: "Size",
      responsive: true,
      options: [
        { label: "Small", value: "small" },
        { label: "Large", value: "large" },
      ],
    },
    wide: { kind: "toggle", label: "Wide" },
    content: { kind: "slot", label: "Content" },
  } as const satisfies Record<string, FieldDef>;

  it("refuses a default for a field it doesn't have, or a choice it doesn't offer, as it types", () => {
    // Type errors, and refused at run time too.
    expect(() =>
      defineComponent({
        label: "Card",
        fields,
        // @ts-expect-error: no field "colour".
        defaults: { colour: "red" },
        render: () => null,
      }),
    ).toThrow(`'Card' has a default for "colour"`);
    expect(() =>
      defineComponent({
        label: "Card",
        fields,
        // @ts-expect-error: "huge" isn't a choice of "size".
        defaults: { size: "huge" },
        render: () => null,
      }),
    ).toThrow(`'Card' defaults "size" to "huge"`);
    expect(() =>
      defineComponent({ label: "Card", fields, defaults: { size: "large" }, render: () => null }),
    ).not.toThrow();
  });

  it("gives render its values typed by its fields, its slots as components", () => {
    defineComponent({
      label: "Card",
      fields,
      defaults: {},
      variants: [
        { label: "Left", value: "left" },
        { label: "Right", value: "right" },
      ],
      render: ({ values, slots }) => {
        expectTypeOf(values.title).toEqualTypeOf<ReactNode>();
        expectTypeOf(values.note).toEqualTypeOf<string>();
        expectTypeOf(values.wide).toEqualTypeOf<boolean>();
        expectTypeOf(values.variant).toEqualTypeOf<"left" | "right">();
        expectTypeOf(values.size).toEqualTypeOf<Responsive<"small" | "large">>();
        expectTypeOf(slots.content).not.toBeNever();
        // @ts-expect-error: a slot is rendered from `slots`, not read from `values`.
        void values.content;
        return null;
      },
    });
  });

  it("reads each value as its kind gives it, whatever the document holds", () => {
    const seen: unknown[] = [];
    const card = defineComponent({
      label: "Card",
      fields,
      defaults: { size: "large", wide: false },
      render: ({ values, slots }) => {
        seen.push(values, slots.content);
        return null;
      },
    });

    card.render({
      id: "card-1",
      values: {
        title: 42,
        note: ["not text"],
        size: "huge",
        wide: "yes",
        bindings: { title: "x" },
      },
      slots: {},
      context: EDITOR_RENDER_CONTEXT,
    });

    const [values, content] = seen as [Record<string, unknown>, unknown];
    expect(values).toEqual({
      title: 42,
      note: "",
      // Not a choice: the default.
      size: "large",
      wide: false,
      // What isn't a field passes as it is.
      bindings: { title: "x" },
    });
    // A slot with nothing in it renders nothing.
    expect(typeof content).toBe("function");
    expect(isValidElement((content as () => ReactNode)())).toBe(false);
  });

  it("checks each device's value of a field set per device (F-ED-4)", () => {
    let size: unknown;
    const card = defineComponent({
      label: "Card",
      fields,
      defaults: { size: "small" },
      render: ({ values }) => {
        size = values.size;
        return null;
      },
    });

    card.render({
      id: "card-1",
      values: { size: { $responsive: { desktop: "large", mobile: "huge" } } },
      slots: {},
      context: EDITOR_RENDER_CONTEXT,
    });

    expect(size).toEqual({ $responsive: { desktop: "large", mobile: "small" } });
  });
});

describe("createLibrary (2.5)", () => {
  const element = (label: string): ComponentDef => ({
    label,
    fields: {},
    defaults: {},
    render: () => null,
  });
  const box: ComponentDef = {
    label: "Box",
    place: "section",
    fields: { content: { kind: "slot", label: "Content", accepts: "element" } },
    defaults: {},
    render: () => null,
  };

  it("lets a slot that accepts elements hold every element, those of later families too", () => {
    const library = createLibrary(
      { Box: box, Title: element("Title") },
      { Banner: { ...box, label: "Banner" }, Note: element("Note") },
    );

    expect(library.components.Box?.fields.content).toEqual({
      kind: "slot",
      label: "Content",
      accepts: "element",
      allow: ["Title", "Note"],
    });
  });

  it("refuses a component type defined twice", () => {
    expect(() => createLibrary({ Title: element("Title") }, { Title: element("Other") })).toThrow(
      `The component "Title" is defined twice`,
    );
  });

  it("gives the site library's Section every element, and nothing that isn't one", () => {
    const content = siteLibrary.components.Section?.fields.content;

    expect(content?.kind === "slot" ? content.allow : undefined).toEqual(["Heading", "Text"]);
  });
});
