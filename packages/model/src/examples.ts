import { z } from "zod";

/**
 * A node's text fields that hold an example (#1228, WN-3), by field name: `{ quote: true }`. A
 * field in a list item is named by the list, the item's id and the field (`items.k3f.text`), so a
 * mark stays with its item when the list is reordered. Stored in `props.examples`, beside the
 * fields, as bindings are.
 */
export type ExampleMarks = Readonly<Record<string, true>>;

/** The longest field name a mark takes: a list item's path is a few names and numbers. */
const FIELD_NAME_MAX = 200;

/** {@link ExampleMarks} as files and IPC carry them. */
export const exampleMarksSchema = z.record(
  z.string().min(1).max(FIELD_NAME_MAX),
  z.literal(true),
) satisfies z.ZodType<ExampleMarks>;

/** The props a mark is read from and written to: a node's, or a draft of them. */
type Marked = { examples?: ExampleMarks | undefined };

/** Whether `field` of the node with `props` is marked as holding an example. */
export const isExample = (props: Marked, field: string): boolean =>
  props.examples?.[field] === true;

/** The fields of the node with `props` marked as holding an example, in the order they were marked. */
export const exampleFields = (props: Marked): readonly string[] =>
  Object.keys(props.examples ?? {});

/** Marks `fields` of the node with `props`, a draft, as holding an example. */
export function markExamples(props: Marked, fields: Iterable<string>): void {
  const marks: Record<string, true> = { ...props.examples };
  for (const field of fields) marks[field] = true;
  if (Object.keys(marks).length > 0) props.examples = marks;
}

/**
 * Clears `field`'s mark on the node with `props`, a draft: the person edited the text, or said it's
 * correct. `examples` goes when it marks nothing more. Whether there was one to clear.
 */
export function clearExample(props: Marked, field: string): boolean {
  if (!isExample(props, field)) return false;
  const { [field]: _cleared, ...rest } = props.examples ?? {};
  if (Object.keys(rest).length === 0) delete props.examples;
  else props.examples = rest;
  return true;
}

/** A list item's id, if `item` is a list item with one. */
const itemId = (item: unknown): string | undefined =>
  typeof item === "object" && item !== null && "id" in item && typeof item.id === "string"
    ? item.id
    : undefined;

/** The item of `list` with id `id`, if `list` is a list and has it. */
const itemWithId = (list: unknown, id: string): Record<string, unknown> | undefined =>
  Array.isArray(list)
    ? (list.find((item: unknown) => itemId(item) === id) as Record<string, unknown> | undefined)
    : undefined;

/**
 * The mark's name for `field` of the node with `props`, a field named as Site Check names it: a
 * field's own name, or a list item's path by its place (`items.2.text`), which becomes the item's
 * id (`items.k3f.text`). An item without an id keeps its place.
 */
export function exampleKey(props: Readonly<Record<string, unknown>>, field: string): string {
  const [list, index, ...rest] = field.split(".");
  if (list === undefined || index === undefined || rest.length === 0) return field;
  const items = props[list];
  const id = Array.isArray(items) ? itemId(items[Number(index)]) : undefined;
  return id === undefined ? field : [list, id, ...rest].join(".");
}

/**
 * Clears the marks that writing `field` of the node with `props`, a draft, from `before` to `after`
 * edited: the field's own, or, for a list, those of each item whose marked field changed or that
 * went. In the step that writes it: editing a text clears its mark (#1228).
 */
export function clearEditedExamples(
  props: Marked,
  field: string,
  before: unknown,
  after: unknown,
): void {
  if (props.examples === undefined || before === after) return;
  for (const key of exampleFields(props)) {
    if (key === field) {
      clearExample(props, key);
      continue;
    }
    if (!key.startsWith(`${field}.`)) continue;
    const [id = "", ...path] = key.slice(field.length + 1).split(".");
    const name = path.join(".");
    const now = itemWithId(after, id);
    if (now === undefined || itemWithId(before, id)?.[name] !== now[name]) {
      clearExample(props, key);
    }
  }
}

/**
 * A testimonial's fields that a made-up one makes up: the review, who gave it and who they are. A
 * generated or template sample testimonial is always marked on them (#1228, WN-3): on a live site
 * it would be a fake review.
 */
export const TESTIMONIAL_EXAMPLE = {
  type: "Testimonial",
  fields: ["quote", "name", "role"],
} as const;

/** Marks the testimonial with `props` as an example, on each of its fields that has a value. */
export function markTestimonial(props: Marked & Readonly<Record<string, unknown>>): void {
  markExamples(
    props,
    TESTIMONIAL_EXAMPLE.fields.filter((field) => {
      const value = props[field];
      return typeof value === "string" && value.trim() !== "";
    }),
  );
}
