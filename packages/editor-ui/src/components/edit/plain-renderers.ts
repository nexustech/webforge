import { ChoiceField } from "./choice-field.js";
import type { FieldRenderer, PlainFieldKind } from "./field-spec.js";
import { SelectField } from "./select-field.js";
import { SliderField } from "./slider-field.js";
import { TextField } from "./text-field.js";
import { ToggleField } from "./toggle-field.js";

/** The renderers for plain values, which fields and list items share. */
export const PLAIN_RENDERERS: { readonly [K in PlainFieldKind]: FieldRenderer<K> } = {
  text: TextField,
  select: SelectField,
  toggle: ToggleField,
  slider: SliderField,
  color: ChoiceField,
  spacing: ChoiceField,
};
