import { t } from "@webforge/i18n";
import { isResponsiveValue, type Responsive } from "@webforge/model";
import { BEHAVIOUR_SCRIPTS } from "./behaviours.js";
import type {
  ComponentDef,
  ComponentLibrary,
  ComponentPlace,
  FieldDef,
  FieldOption,
} from "./library.js";

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

/**
 * What {@link defineComponent} takes: a {@link ComponentDef}, and optionally its layout variants
 * (a Hero with the image on the left or right, a grid of two or three columns), which become a
 * Style choice named `variant`, defaulting to the first. The component renders each one.
 */
export type ComponentSpec = ComponentDef & {
  readonly variants?: readonly FieldOption[];
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

/**
 * A site component (05, S1), checked as it is defined, so a mistake fails every test that loads
 * the library instead of reaching a site:
 * - a display name (D2), already translated;
 * - style fields, and fields that may differ per device (F-ED-4), are design tokens only (C4);
 * - every choice field offers choices, each once, and its default is one of them;
 * - every default is for a field;
 * - an option group's name, if given, is a short name (1 to 40 characters);
 * - the `webforge.js` behaviours it needs exist (see `behaviours/`).
 *
 * `variants` add the layout choice described at {@link ComponentSpec}.
 */
export function defineComponent(spec: ComponentSpec): ComponentDef {
  const { variants, ...def } = spec;
  const name = def.label.trim() === "" ? "A component" : `'${def.label}'`;
  function fail(problem: string): never {
    throw new Error(`${name} ${problem}`);
  }
  if (def.label.trim() === "") fail("needs a display name");
  let fields = def.fields;
  let defaults = def.defaults;
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
  return { ...def, fields, defaults };
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
