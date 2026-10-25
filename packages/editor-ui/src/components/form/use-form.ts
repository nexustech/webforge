import { useState } from "react";
import { sameValue } from "../../lib/same-value.js";
import type { ListChange, ListItem } from "../edit/field-spec.js";
import type { FormField, FormIssue, FormSpec, FormValues } from "./form-spec.js";

/** What saving a form gives: the checked value and the groups whose fields changed, or nothing. */
export type FormSubmit<Out> =
  | { readonly ok: true; readonly output: Out; readonly changedGroups: readonly string[] }
  | { readonly ok: false };

/** A form being edited: its spec, values, fields and problems, and what changes and saves it. */
export type FormState<V extends FormValues, Out> = {
  readonly spec: FormSpec<V, Out>;
  readonly values: V;
  readonly fields: readonly FormField[];
  /** The problems to show now: none until they should show (`validateOn`). */
  readonly issues: readonly FormIssue[];
  /** Sets field `name`'s value; a `list` field takes a {@link ListChange}. */
  readonly change: (name: string, value: unknown) => void;
  /** Checks the values; from now on their problems show as they change. */
  readonly submit: () => FormSubmit<Out>;
  /** How many times Save was tried: the form shows the first problem after each failed one. */
  readonly attempts: number;
};

/** The fields of `spec` for `values`. */
const fieldsOf = <V extends FormValues>(spec: FormSpec<V, unknown>, values: V) =>
  typeof spec.fields === "function" ? spec.fields(values) : spec.fields;

/** A schema issue's path as plain keys. */
const keysOf = (path: readonly (PropertyKey | { readonly key: PropertyKey })[] | undefined) =>
  (path ?? []).map((segment) => (typeof segment === "object" ? segment.key : segment));

/** Checks `values` against `spec`: its own check first, then its schema. */
export function checkForm<V extends FormValues, Out>(
  spec: FormSpec<V, Out>,
  values: V,
):
  | { readonly output: Out; readonly issues: readonly [] }
  | { readonly issues: readonly FormIssue[] } {
  const own = spec.check?.(values) ?? [];
  const result = spec.schema["~standard"].validate(spec.toModel(values));
  if (result instanceof Promise) throw new Error("A form's schema must check synchronously");
  const issues = [
    ...own,
    ...(result.issues ?? []).map((issue) => ({ path: keysOf(issue.path), message: issue.message })),
  ];
  return result.issues === undefined && issues.length === 0
    ? { output: result.value, issues: [] }
    : { issues };
}

/** A path as a field's pattern: dotted, any list position as `*`. */
const patternOf = (path: readonly PropertyKey[]) =>
  path.map((key) => (typeof key === "number" ? "*" : String(key))).join(".");

/**
 * The message of `field`'s first problem in `issues`, if any: one at its path, or inside it (an
 * item of a list).
 */
export function issueOf(field: FormField, issues: readonly FormIssue[]): string | undefined {
  const own = field.path ?? field.name;
  return issues.find((issue) => {
    const pattern = patternOf(issue.path);
    return pattern === own || pattern.startsWith(`${own}.`);
  })?.message;
}

/** The problems in `issues` that none of `fields` shows, which the form shows above them. */
export const unplacedIssues = (fields: readonly FormField[], issues: readonly FormIssue[]) =>
  issues.filter((issue) => !fields.some((field) => issueOf(field, [issue]) !== undefined));

/** The groups of the fields whose values differ between `before` and `after`, in the form's order. */
export function changedGroups<V extends FormValues>(
  spec: FormSpec<V, unknown>,
  before: V,
  after: V,
): readonly string[] {
  const changed = new Set(
    fieldsOf(spec, after)
      .filter((field) => !sameValue(before[field.name], after[field.name]))
      .map((field) => field.group ?? ""),
  );
  const order = spec.groups?.map((group) => group.id) ?? [""];
  return order.filter((group) => changed.has(group));
}

/** `items` after a list field's `change`; a new item is `newItem`'s values with a fresh id. */
export function applyListChange(
  items: readonly ListItem[],
  change: ListChange,
  newItem: () => FormValues = () => ({}),
): readonly ListItem[] {
  switch (change.type) {
    case "add":
      return [...items, { ...newItem(), id: crypto.randomUUID() }];
    case "remove":
      return items.filter((item) => item.id !== change.id);
    case "edit":
      return items.map((item) =>
        item.id === change.id ? { ...item, [change.name]: change.value } : item,
      );
    case "move": {
      const moved = items.find((item) => item.id === change.id);
      if (moved === undefined) return items;
      const rest = items.filter((item) => item !== moved);
      return [...rest.slice(0, change.to), moved, ...rest.slice(change.to)];
    }
  }
}

/** A list field's items in `value`, which holds them when it is an array. */
const itemsOf = (value: unknown): readonly ListItem[] =>
  Array.isArray(value) ? (value as readonly ListItem[]) : [];

/** Edits a form of `spec`, starting from `initial` (2.21): its values, problems and Save. */
export function useForm<V extends FormValues, Out>(
  spec: FormSpec<V, Out>,
  initial: V,
): FormState<V, Out> {
  const [values, setValues] = useState(initial);
  const [first] = useState(initial);
  const [showing, setShowing] = useState(spec.validateOn === "change");
  const [attempts, setAttempts] = useState(0);
  const fields = fieldsOf(spec, values);
  const issues = showing ? checkForm(spec, values).issues : [];

  // From the values as they are when the change applies, so changes made together (a link and its
  // anchor, a preset filling several fields) all count.
  const change = (name: string, value: unknown) =>
    setValues((current) => {
      const field = fieldsOf(spec, current).find((each) => each.name === name);
      const next =
        field?.kind === "list"
          ? applyListChange(itemsOf(current[name]), value as ListChange, field.newItem)
          : value;
      const changed = { ...current, [name]: next } as V;
      return spec.adjust?.(changed, current) ?? changed;
    });

  const submit = (): FormSubmit<Out> => {
    setShowing(true);
    setAttempts(attempts + 1);
    const checked = checkForm(spec, values);
    return "output" in checked
      ? { ok: true, output: checked.output, changedGroups: changedGroups(spec, first, values) }
      : { ok: false };
  };

  return { spec, values, fields, issues, change, submit, attempts };
}
