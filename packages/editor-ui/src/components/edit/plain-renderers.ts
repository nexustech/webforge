import { ChoiceField } from "./choice-field.js";
import type { FieldRenderer } from "./field-registry.js";
import { SelectField } from "./select-field.js";
import { SliderField } from "./slider-field.js";
import { TextField } from "./text-field.js";
import { ToggleField } from "./toggle-field.js";

/** The renderers for plain values, which fields and list items share. */
export const PLAIN_RENDERERS: Readonly<Record<string, FieldRenderer>> = {
  text: TextField,
  select: SelectField,
  toggle: ToggleField,
  slider: SliderField,
  color: ChoiceField,
  spacing: ChoiceField,
};

/**
 * The renderer for a plain `kind`: one of `registered` ({@link useFieldRenderers}), else the
 * built-in one, else undefined.
 */
export function plainRenderer(
  registered: ReadonlyMap<string, FieldRenderer>,
  kind: string,
): FieldRenderer | undefined {
  return registered.get(kind) ?? PLAIN_RENDERERS[kind];
}
