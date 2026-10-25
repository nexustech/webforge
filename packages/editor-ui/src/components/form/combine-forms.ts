import type {
  FormField,
  FormIssue,
  FormSchema,
  FormSchemaResult,
  FormSpec,
  FormValues,
} from "./form-spec.js";

/** What a {@link FormPart} is made from: one form's spec, and where it is listed. */
type FormPartOf<V extends FormValues, Out> = {
  /** Unique among the parts; its values, groups and problems are kept apart by it. */
  readonly id: string;
  /** The heading its groups are listed under ("App", "This site"). */
  readonly heading: string;
  /** Its group's name, for a part whose spec has no groups of its own ("Interface"). */
  readonly label: string;
  readonly spec: FormSpec<V, Out>;
  readonly initial: V;
};

/**
 * One form of several shown as one (LF-12's Settings: the app's and the site's), made by
 * {@link formPart}: its spec over its own values, whatever their shape.
 */
export type FormPart = Omit<FormPartOf<FormValues, unknown>, "spec"> & {
  readonly spec: FormSpec<FormValues, unknown>;
};

/**
 * `part` as one of several forms shown as one. The combined form gives each part only the values it
 * started from, so its spec sees them in its own shape.
 */
export function formPart<V extends FormValues, Out>(part: FormPartOf<V, Out>): FormPart {
  const { spec } = part;
  const own = (values: FormValues) => values as V;
  const { fields, check, adjust } = spec;
  return {
    ...part,
    spec: {
      ...(spec.groups === undefined ? {} : { groups: spec.groups }),
      fields: typeof fields === "function" ? (values) => fields(own(values)) : fields,
      schema: spec.schema,
      toModel: (values) => spec.toModel(own(values)),
      ...(check === undefined ? {} : { check: (values: FormValues) => check(own(values)) }),
      ...(adjust === undefined
        ? {}
        : { adjust: (next: FormValues, previous: FormValues) => adjust(own(next), own(previous)) }),
    },
  };
}

/** Several forms as one: its spec and starting values, and its output split back by part. */
export type CombinedForm = {
  readonly spec: FormSpec<FormValues, Readonly<Record<string, unknown>>>;
  readonly initial: FormValues;
};

/** The separator between a part's id and its own names: field names, groups and paths. */
const SEP = ":";

/** `values` of part `id`, without the prefix that keeps them apart from the others'. */
function valuesOf(values: FormValues, id: string): FormValues {
  const prefix = `${id}${SEP}`;
  return Object.fromEntries(
    Object.entries(values)
      .filter(([name]) => name.startsWith(prefix))
      .map(([name, value]) => [name.slice(prefix.length), value]),
  );
}

/** `values` with each name prefixed by part `id`. */
const withPrefix = (values: FormValues, id: string): FormValues =>
  Object.fromEntries(Object.entries(values).map(([name, value]) => [`${id}${SEP}${name}`, value]));

/** The schema of every part: each checks its own output, its problems' paths under its id. */
function combinedSchema(parts: readonly FormPart[]): FormSchema<Readonly<Record<string, unknown>>> {
  return {
    "~standard": {
      validate(value: unknown): FormSchemaResult<Readonly<Record<string, unknown>>> {
        const outputs: Record<string, unknown> = {};
        const issues: { message: string; path: readonly PropertyKey[] }[] = [];
        for (const part of parts) {
          // Checks are synchronous (FormSchema).
          const result = part.spec.schema["~standard"].validate(
            (value as Readonly<Record<string, unknown>>)[part.id],
          ) as FormSchemaResult<unknown>;
          if (result.issues === undefined) {
            outputs[part.id] = result.value;
          } else {
            for (const issue of result.issues) {
              const keys = (issue.path ?? []).map((key) =>
                typeof key === "object" ? key.key : key,
              );
              issues.push({ message: issue.message, path: [part.id, ...keys] });
            }
          }
        }
        return issues.length === 0 ? { value: outputs } : { issues };
      },
    },
  };
}

/**
 * Shows `parts` as one form (LF-12): each part's fields, values and groups prefixed by its id
 * (`site:name`), its groups listed under its heading, and its own schema, checks and adjustments
 * applied to its own values. The output is each part's, by id; a Save checks them all at once.
 */
export function combineForms(parts: readonly FormPart[]): CombinedForm {
  const groups = parts.flatMap((part) =>
    (part.spec.groups ?? [{ id: "", label: part.label }]).map((group) => ({
      id: `${part.id}${SEP}${group.id}`,
      label: group.label,
      heading: part.heading,
    })),
  );
  const fieldsOf = (part: FormPart, values: FormValues): readonly FormField[] => {
    const own = valuesOf(values, part.id);
    const fields =
      typeof part.spec.fields === "function" ? part.spec.fields(own) : part.spec.fields;
    return fields.map((field) => ({
      ...field,
      name: `${part.id}${SEP}${field.name}`,
      group: `${part.id}${SEP}${field.group ?? ""}`,
      path: `${part.id}.${field.path ?? field.name}`,
    }));
  };
  return {
    spec: {
      groups,
      fields: (values) => parts.flatMap((part) => fieldsOf(part, values)),
      schema: combinedSchema(parts),
      toModel: (values) =>
        Object.fromEntries(
          parts.map((part) => [part.id, part.spec.toModel(valuesOf(values, part.id))]),
        ),
      check: (values) =>
        parts.flatMap((part): readonly FormIssue[] =>
          (part.spec.check?.(valuesOf(values, part.id)) ?? []).map((issue) => ({
            ...issue,
            path: [part.id, ...issue.path],
          })),
        ),
      adjust: (next, previous) =>
        Object.assign(
          {},
          ...parts.map((part) => {
            const own = valuesOf(next, part.id);
            const adjusted = part.spec.adjust?.(own, valuesOf(previous, part.id)) ?? own;
            return withPrefix(adjusted, part.id);
          }),
        ) as FormValues,
      validateOn: "save",
    },
    initial: Object.assign({}, ...parts.map((part) => withPrefix(part.initial, part.id))),
  };
}
