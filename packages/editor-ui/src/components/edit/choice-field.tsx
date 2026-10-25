import { ToggleGroup, ToggleGroupItem } from "../ui/toggle-group.js";
import type { FieldRendererProps } from "./field-spec.js";
import { describedBy } from "./text-field.js";

/**
 * A short row of choices (Small · Medium · Large, the theme's colours): one click is one change.
 * Clicking the chosen one again keeps it, so the field always has a value.
 */
export function ChoiceField({
  id,
  labelId,
  helpId,
  errorId,
  disabled = false,
  field,
  value,
  onChange,
  onCommit,
}: FieldRendererProps<"color" | "spacing" | "choice">) {
  const { options } = field;
  return (
    <ToggleGroup
      id={id}
      type="single"
      aria-labelledby={labelId}
      aria-invalid={errorId !== undefined}
      aria-describedby={describedBy(errorId, helpId)}
      disabled={disabled}
      className="flex w-full flex-wrap"
      value={typeof value === "string" ? value : ""}
      onValueChange={(next) => {
        if (next !== "") {
          onChange(next);
          onCommit();
        }
      }}
    >
      {options.map((option) => (
        <ToggleGroupItem
          key={option.value}
          value={option.value}
          // Never narrower than its label: in a narrow column (LF-7) the options wrap instead.
          className="min-w-fit flex-1"
        >
          {option.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
