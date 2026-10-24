import type { FieldRendererProps } from "./field-spec.js";
import { fieldControlClass } from "./text-field.js";

/** A choice from a short list, as a native select (keyboard and screen readers for free). */
export function SelectField({
  id,
  helpId,
  field,
  value,
  onChange,
  onCommit,
}: FieldRendererProps<"select">) {
  const { options } = field;
  const selected = options.some((option) => option.value === value) ? (value as string) : "";
  return (
    <select
      id={id}
      className={fieldControlClass}
      aria-describedby={helpId}
      value={selected}
      onChange={(event) => {
        onChange(event.target.value);
        onCommit();
      }}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
