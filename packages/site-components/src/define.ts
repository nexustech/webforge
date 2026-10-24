import { t } from "@webforge/i18n";
import {
  imageValueSchema,
  isResponsiveValue,
  linkValueSchema,
  type Responsive,
  responsiveBoxOf,
  type TextStyle,
} from "@webforge/model";
import type { ComponentType, ReactNode } from "react";
import { BEHAVIOUR_SCRIPTS } from "./behaviours.js";
import {
  type ComponentDef,
  type ComponentLibrary,
  type ComponentRenderProps,
  textValue,
} from "./library.js";
import type {
  ComponentPlace,
  DefaultsOf,
  FieldDef,
  FieldOption,
  RenderPropsOf,
  ValuesOf,
} from "./schema.js";

/**
 * Field kinds whose values are design tokens (C4): a choice from the component's own options, a
 * step, on or off, a theme colour, a spacing size. Only these may style a component or differ per
 * device; free values (text, links, images) are content.
 */
const TOKEN_KINDS: ReadonlySet<FieldDef["kind"]> = new Set([
  "select",
  "toggle",
  "slider",
  "color",
  "spacing",
  "box",
]);

/** The longest name an option group may have (UX-13), in characters. */
const MAX_OPTION_GROUP = 40;

/** An option group's id: lower camel case, at most 40 characters ("typography", "textStyle"). */
const OPTION_GROUP_ID = /^[a-z][a-zA-Z0-9]{0,39}$/;

/** The field a component's layout variants are stored in. */
const VARIANT_FIELD = "variant";

/** The fields of a component: its definition's, by field name. */
type Fields = Readonly<Record<string, FieldDef>>;

/**
 * What {@link defineComponent} takes: a {@link ComponentDef} whose `defaults`, `render` and
 * `textStyle` are typed by its `fields` (R7), and optionally its layout variants (a Hero with the
 * image on the left or right, a grid of two or three columns), which become a Style choice named
 * `variant`, defaulting to the first. The component renders each one.
 */
export type ComponentSpec<F extends Fields, Variant extends string = never> = Omit<
  ComponentDef,
  "fields" | "defaults" | "render" | "textStyle"
> & {
  readonly fields: F;
  readonly defaults: DefaultsOf<F>;
  readonly variants?: readonly { readonly label: string; readonly value: Variant }[];
  readonly render: (props: RenderPropsOf<F, Variant>) => ReactNode;
  /**
   * The theme's text style its text is set in (h1–h6, body, small), from its values; none for a
   * component without text of its own. Sets how much contrast a colour on it needs (WCAG AA's
   * large text, 1.37).
   */
  readonly textStyle?: (values: ValuesOf<F, Variant>) => TextStyle | undefined;
};

/** The choices of a field with a fixed set of them, if it has one. */
function choicesOf(field: FieldDef): readonly FieldOption[] | undefined {
  switch (field.kind) {
    case "select":
    case "color":
    case "spacing":
      return field.options;
    case "slider":
      return field.steps;
    default:
      return undefined;
  }
}

/** `value`, or with `one` applied to each device's value if it is set per device (F-ED-4). */
function eachDevice(value: unknown, one: (value: unknown) => unknown): unknown {
  if (!isResponsiveValue(value as Responsive<unknown>)) return one(value);
  const { $responsive } = value as { readonly $responsive: Readonly<Record<string, unknown>> };
  return {
    $responsive: Object.fromEntries(
      Object.entries($responsive).map(([device, each]) => [device, one(each)]),
    ),
  };
}

/** The Desktop value of a value that may be set per device. */
function desktopOf(value: unknown): unknown {
  return isResponsiveValue(value as Responsive<unknown>)
    ? (value as { readonly $responsive: { readonly desktop?: unknown } }).$responsive.desktop
    : value;
}

/**
 * A function that gives a field's stored value as `render` gets it (`FieldValue`). The document
 * comes from a file, so it can hold anything: a choice not offered falls back to the default, else
 * the first choice; an invalid image or link is left out; text is something to render.
 */
function valueReader(field: FieldDef, initial: unknown): (value: unknown) => unknown {
  const choices = choicesOf(field)?.map((choice) => choice.value);
  const fallback = desktopOf(initial);
  const one = (value: unknown): unknown => {
    switch (field.kind) {
      case "text":
        if (field.inline === true) return textValue(value);
        return typeof value === "string" ? value : typeof value === "number" ? String(value) : "";
      case "richtext":
        return textValue(value);
      case "select":
      case "spacing":
      case "slider": {
        const offered = choices ?? [];
        if (typeof value === "string" && offered.includes(value)) return value;
        return typeof fallback === "string" && offered.includes(fallback) ? fallback : offered[0];
      }
      case "color":
        // Any colour ref, not only the choices offered first (1.37, ADR 0009).
        return typeof value === "string"
          ? value
          : typeof fallback === "string"
            ? fallback
            : "default";
      case "toggle":
        return typeof value === "boolean" ? value : fallback === true;
      case "media": {
        const image = imageValueSchema.safeParse(value);
        return image.success ? image.data : undefined;
      }
      case "link": {
        const link = linkValueSchema.safeParse(value);
        if (link.success) return link.data;
        return typeof value === "string" ? value : undefined;
      }
      case "list":
        return Array.isArray(value) ? value : Array.isArray(initial) ? initial : [];
      default:
        return value;
    }
  };
  // A box reads its older forms too, per device or not (1.32).
  if (field.kind === "box") return (value) => responsiveBoxOf(value);
  return field.responsive === true ? (value) => eachDevice(value, one) : one;
}

const EmptySlot: ComponentType = () => null;

/**
 * A site component (05, S1), checked as it is defined. Its `fields` type its `defaults` and the
 * values its `render` and `textStyle` get (R7): a default for a field it doesn't have, or a choice
 * it doesn't offer, is a type error, and `render` gets each value in its field's form, read from
 * whatever the document holds (see `FieldValue`). Checked as the module loads, so a mistake fails
 * every test that loads the library instead of reaching a site:
 * - a display name (D2), already translated;
 * - style fields, and fields that may differ per device (F-ED-4), are design tokens only (C4);
 * - every choice field offers choices, each once, and its default is one of them;
 * - every default is for a field;
 * - an option group's name, if given, is a short name (1 to 40 characters);
 * - the `webforge.js` behaviours it needs exist (see `behaviours/`).
 *
 * `variants` add the layout choice described at {@link ComponentSpec}.
 */
export function defineComponent<const F extends Fields, const Variant extends string = never>(
  spec: ComponentSpec<F, Variant> & { readonly defaults: NoInfer<DefaultsOf<F>> },
): ComponentDef {
  const { variants, render, textStyle, ...def } = spec;
  const name = def.label.trim() === "" ? "A component" : `'${def.label}'`;
  function fail(problem: string): never {
    throw new Error(`${name} ${problem}`);
  }
  if (def.label.trim() === "") fail("needs a display name");
  let fields: Fields = def.fields;
  let defaults: Readonly<Record<string, unknown>> = def.defaults;
  if (variants !== undefined) {
    if (Object.hasOwn(fields, VARIANT_FIELD))
      fail(`has variants and a field named "${VARIANT_FIELD}"`);
    const [first] = variants;
    if (first === undefined) fail("has no variants");
    fields = {
      ...fields,
      [VARIANT_FIELD]: {
        kind: "select",
        group: "style",
        label: t("field.variant"),
        options: variants,
      },
    };
    defaults = { [VARIANT_FIELD]: first.value, ...defaults };
  }
  for (const [fieldName, field] of Object.entries(fields)) {
    const style =
      field.group === "style" || (field.group === undefined && TOKEN_KINDS.has(field.kind));
    if (style && !TOKEN_KINDS.has(field.kind)) {
      fail(`styles with "${fieldName}", a ${field.kind} field: style fields are design tokens`);
    }
    if (field.responsive === true && !TOKEN_KINDS.has(field.kind)) {
      fail(`sets "${fieldName}", a ${field.kind} field, per device: only design tokens can be`);
    }
    if (field.optionGroup !== undefined) {
      const length = field.optionGroup.label.trim().length;
      if (length === 0 || length > MAX_OPTION_GROUP) {
        fail(`puts "${fieldName}" in an option group without a short name`);
      }
      if (!OPTION_GROUP_ID.test(field.optionGroup.id)) {
        fail(`puts "${fieldName}" in an option group without an id such as "typography"`);
      }
    }
    const choices = choicesOf(field);
    if (choices !== undefined) {
      const values = choices.map((choice) => choice.value);
      if (values.length === 0) fail(`offers no choices for "${fieldName}"`);
      if (new Set(values).size !== values.length) fail(`offers a choice twice for "${fieldName}"`);
      // A default set per device (F-ED-4) has a value for each device it sets.
      const value = defaults[fieldName] as Responsive<unknown>;
      const each = isResponsiveValue(value) ? Object.values(value.$responsive) : [value];
      for (const one of each) {
        if (one !== undefined && !values.includes(String(one))) {
          fail(`defaults "${fieldName}" to "${String(one)}", which isn't one of its choices`);
        }
      }
    }
  }
  for (const key of Object.keys(defaults)) {
    if (!Object.hasOwn(fields, key)) fail(`has a default for "${key}", which isn't a field`);
  }
  for (const behaviour of def.behaviours ?? []) {
    if (!Object.hasOwn(BEHAVIOUR_SCRIPTS, behaviour)) {
      fail(`needs the behaviour "${behaviour}", which isn't in behaviours/`);
    }
  }

  const readers = Object.entries(fields)
    .filter(([, field]) => field.kind !== "slot")
    .map(([fieldName, field]) => [fieldName, valueReader(field, defaults[fieldName])] as const);
  const slotNames = Object.entries(fields)
    .filter(([, field]) => field.kind === "slot")
    .map(([fieldName]) => fieldName);
  /** The values `render` gets: every field's as its kind gives it, the rest (`bindings`) as stored. */
  const valuesOf = (stored: Readonly<Record<string, unknown>>) => {
    const values: Record<string, unknown> = { ...stored };
    for (const [fieldName, read] of readers) values[fieldName] = read(stored[fieldName]);
    return values as ValuesOf<F, Variant>;
  };
  return {
    ...def,
    fields,
    defaults,
    render: (props: ComponentRenderProps) =>
      render({
        id: props.id,
        values: valuesOf(props.values),
        slots: Object.fromEntries(
          slotNames.map((slot) => [slot, props.slots[slot] ?? EmptySlot]),
        ) as RenderPropsOf<F, Variant>["slots"],
        context: props.context,
      }),
    ...(textStyle === undefined ? {} : { textStyle: (stored) => textStyle(valuesOf(stored)) }),
  };
}

/**
 * The library of `families` (each module's components, by type): one record, a type defined once.
 * A slot that `accepts` a place holds every component of that place (ADR 0005): a Section takes
 * each element, including those of families added later, without listing them.
 */
export function createLibrary(
  ...families: readonly Readonly<Record<string, ComponentDef>>[]
): ComponentLibrary {
  const components: Record<string, ComponentDef> = {};
  for (const family of families) {
    for (const [type, def] of Object.entries(family)) {
      if (Object.hasOwn(components, type))
        throw new Error(`The component "${type}" is defined twice`);
      components[type] = def;
    }
  }
  const placed = (place: ComponentPlace) =>
    Object.entries(components)
      .filter(([, def]) => (def.place ?? "element") === place)
      .map(([type]) => type);
  for (const [type, def] of Object.entries(components)) {
    const fields = Object.fromEntries(
      Object.entries(def.fields).map(([name, field]) => [
        name,
        field.kind === "slot" && field.accepts !== undefined
          ? { ...field, allow: placed(field.accepts) }
          : field,
      ]),
    );
    components[type] = { ...def, fields };
  }
  return { components };
}
