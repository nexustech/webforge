import type { FieldRendererProps } from "./field-spec.js";
import { describedBy, fieldControlClass } from "./text-field.js";

/** A choice from a short list, as a native select (keyboard and screen readers for free). */
export function SelectField({
  id,
  helpId,
  errorId,
  disabled = false,
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
      disabled={disabled}
      aria-invalid={errorId !== undefined}
      aria-describedby={describedBy(errorId, helpId)}
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
