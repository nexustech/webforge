import {
  CATALOGUE,
  type CatalogueComponent,
  type CatalogueField,
  fieldValueSchema,
  SHARED_STYLE_FIELDS,
} from "@webforge/site-components/catalogue-data";
import { z } from "zod";

/** Where a component goes, as AI apps place them: never the Header or Footer (`layout`). */
export type Place = "section" | "element" | "child";

/** A component type at a glance (AIB-1): what `components` lists. */
export type ComponentSummary = {
  readonly type: string;
  /** What the Add panel calls it: "Hero". */
  readonly label: string;
  readonly place: Place;
  /** The Add panel's group for it: "Text", "Media"… */
  readonly category?: string;
};

/** A field as an AI app reads it: its kind, label and help, and its value's JSON Schema. */
type FieldDetail = {
  readonly kind: string;
  readonly label: string;
  readonly help?: string;
  /** What its value may be; none for a slot, which holds elements instead. */
  readonly schema?: unknown;
  /** For a slot: the types it takes that AI apps may add, or the place they have. */
  readonly takes?: readonly string[] | Place;
};

/**
 * A component type in full: its fields, presets and defaults, as `addNode` takes them. Its own
 * fields only, unless asked for its styles too: the styling fields it shares with others are named
 * in `styleFields`, and `styleFields` (the query) or the catalogue resource defines them once
 * (#1250).
 */
export type ComponentDetail = ComponentSummary & {
  readonly fields: Readonly<Record<string, FieldDetail>>;
  /** The shared styling fields it has, by name, when they aren't in `fields`. */
  readonly styleFields?: readonly string[];
  readonly presets?: readonly { readonly id: string; readonly label: string }[];
  readonly defaults: Readonly<Record<string, unknown>>;
};

/** Whether field `name` is one of the styling fields components share (#1250). */
export const isSharedStyleField = (name: string) => Object.hasOwn(SHARED_STYLE_FIELDS, name);

/** The styling fields components share, each once, as `fields` would give them (#1250). */
export function styleFieldDetails(): Record<string, FieldDetail> {
  return Object.fromEntries(
    Object.entries(SHARED_STYLE_FIELDS).map(([name, field]) => [name, fieldDetail(field)]),
  );
}

/** Whether AI apps keep away from `component`: Custom Code and Advanced mode's own (R10). */
export const offLimits = (component: CatalogueComponent) =>
  component.advancedOnly === true || Object.values(component.fields).some((f) => f.kind === "code");

/** A field's value schema as JSON Schema, for an AI app to read; none when it can't be one. */
export function jsonSchema(schema: z.ZodType): unknown {
  try {
    return z.toJSONSchema(schema, { unrepresentable: "any" });
  } catch {
    return undefined;
  }
}

/** The types AI apps may add, in the catalogue's order: not the Header, Footer or Custom Code. */
export function usableComponents(): readonly (readonly [string, CatalogueComponent])[] {
  return Object.entries(CATALOGUE).filter(
    ([, component]) => component.place !== "layout" && !offLimits(component),
  );
}

const summaryOf = (type: string, component: CatalogueComponent): ComponentSummary => ({
  type,
  label: component.label,
  place: component.place as Place,
  ...(component.category === undefined ? {} : { category: component.category }),
});

const fieldDetail = (field: CatalogueField): FieldDetail => ({
  kind: field.kind,
  label: field.label,
  ...(field.help === undefined ? {} : { help: field.help }),
  ...(field.kind === "slot"
    ? {
        takes:
          field.allow?.filter((type) => {
            const component = CATALOGUE[type];
            return component !== undefined && !offLimits(component);
          }) ?? ((field.accepts ?? "element") as Place),
      }
    : { schema: jsonSchema(fieldValueSchema(field)) }),
});

/** The usable components, at a glance, `place`'s only when given. */
export function componentSummaries(place?: Place): ComponentSummary[] {
  return usableComponents()
    .filter(([, component]) => place === undefined || component.place === place)
    .map(([type, component]) => summaryOf(type, component));
}

/**
 * Component `type`, if AI apps may add it: its own fields in full, and the shared styling fields
 * it has by name; with `styles`, those in full too, as before #1250.
 */
export function componentDetail(
  type: string,
  { styles = false }: { readonly styles?: boolean } = {},
): ComponentDetail | undefined {
  const component = Object.hasOwn(CATALOGUE, type) ? CATALOGUE[type] : undefined;
  if (component === undefined || component.place === "layout" || offLimits(component)) {
    return undefined;
  }
  const fields = Object.entries(component.fields).filter(([, field]) => field.kind !== "code");
  const shared = styles ? [] : fields.filter(([name]) => isSharedStyleField(name));
  const own = styles ? fields : fields.filter(([name]) => !isSharedStyleField(name));
  return {
    ...summaryOf(type, component),
    fields: Object.fromEntries(own.map(([name, field]) => [name, fieldDetail(field)])),
    ...(shared.length === 0 ? {} : { styleFields: shared.map(([name]) => name) }),
    ...(component.presets === undefined
      ? {}
      : { presets: component.presets.map(({ id, label }) => ({ id, label })) }),
    defaults: styles
      ? component.defaults
      : Object.fromEntries(
          Object.entries(component.defaults).filter(([name]) => !isSharedStyleField(name)),
        ),
  };
}

/**
 * The catalogue as an MCP resource (AIB-1): every type AI apps may add, in full, by type. Read
 * once by an app that reads resources, rather than asking `components` type by type.
 */
export const CATALOGUE_RESOURCE = {
  uri: "webforge://catalogue",
  name: "catalogue",
  title: "The component catalogue",
  description:
    "Every section and element type an AI app may add, by type (components): its place, label, category, own fields (kind, label, help, JSON Schema of the value; a slot's types), the shared styling fields it has by name, presets and defaults, as addNode and updateFields take them. The shared styling fields are defined once, in styleFields.",
  mimeType: "application/json",
} as const;

/** {@link CATALOGUE_RESOURCE}'s content. */
export function catalogueResourceText(): string {
  return JSON.stringify({
    styleFields: styleFieldDetails(),
    components: Object.fromEntries(
      usableComponents().map(([type]) => [type, componentDetail(type)]),
    ),
  });
}
