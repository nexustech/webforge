import { ToggleGroup, ToggleGroupItem } from "../ui/toggle-group.js";
import type { FieldRendererProps } from "./field-registry.js";

/**
 * A short row of choices (Small · Medium · Large, the theme's colours): one click is one change.
 * Clicking the chosen one again keeps it, so the field always has a value.
 */
export function ChoiceField({ id, labelId, field, value, onChange, onCommit }: FieldRendererProps) {
  const options = field.options ?? [];
  return (
    <ToggleGroup
      id={id}
      type="single"
      aria-labelledby={labelId}
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
        <ToggleGroupItem key={option.value} value={option.value} className="flex-1">
          {option.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
