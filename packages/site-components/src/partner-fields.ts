import { acceptsFieldValue } from "./field-values.js";
import type { FieldDef } from "./schema.js";

/** One device's value that `field` takes, as the Edit panel sets it. */
const takes = (field: FieldDef, value: unknown) =>
  acceptsFieldValue(field, value, { responsive: false });

/**
 * What changing field `name` of `fields` to `value` sets besides, in the same step (CT-10): each
 * partner's value (`FieldDef.partners`), those a field of `fields` takes. `values` are the item's
 * on the device it's changed for: its own, over its kind's look and its defaults.
 */
export function partnersOf(
  fields: Readonly<Record<string, FieldDef>>,
  name: string,
  value: unknown,
  values: Readonly<Record<string, unknown>>,
): Readonly<Record<string, unknown>> {
  const partners = fields[name]?.partners?.(value, values) ?? {};
  return Object.fromEntries(
    Object.entries(partners).filter(([partner, given]) => {
      const field = fields[partner];
      return field !== undefined && takes(field, given);
    }),
  );
}

/**
 * What `field` shows for `value`, one device's: its `unset` while it holds none it can take, as an
 * item draws it (CT-10). A gradient's end stored as *Theme's*, or never set, shows as Brand.
 */
export function shownValueOf(field: FieldDef, value: unknown): unknown {
  return field.unset !== undefined && !takes(field, value) ? field.unset : value;
}
