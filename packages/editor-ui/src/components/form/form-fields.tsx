import { cn } from "../../lib/cn.js";
import type { FieldRendererProps } from "../edit/field-spec.js";
import { describedBy, fieldControlClass } from "../edit/text-field.js";
import { ImageChoice } from "./form.js";

// The renderers of the kinds only forms have (2.21), and a form's checkbox. Each draws its control
// only: the form draws its label, help and error around it (`Field`).

/** A whole number, as typed: the form's schema reads the number from the text. */
export function NumberField({
  id,
  helpId,
  errorId,
  disabled = false,
  field,
  value,
  onChange,
  onCommit,
}: FieldRendererProps<"number">) {
  return (
    <input
      id={id}
      type="number"
      inputMode="numeric"
      className={cn(fieldControlClass, "w-24")}
      value={typeof value === "string" || typeof value === "number" ? value : ""}
      min={field.min}
      max={field.max}
      disabled={disabled}
      aria-invalid={errorId !== undefined}
      aria-describedby={describedBy(errorId, helpId)}
      onChange={(event) => onChange(event.target.value)}
      onBlur={onCommit}
    />
  );
}

/** A time of day, `HH:MM`, in the person's own 12- or 24-hour format. */
export function TimeField({
  id,
  helpId,
  errorId,
  disabled = false,
  value,
  onChange,
  onCommit,
}: FieldRendererProps<"time">) {
  return (
    <input
      id={id}
      type="time"
      // Wide enough for a 12-hour clock ("07:00 AM") as well as a 24-hour one.
      className={cn(fieldControlClass, "w-32")}
      value={typeof value === "string" ? value : ""}
      disabled={disabled}
      aria-invalid={errorId !== undefined}
      aria-describedby={describedBy(errorId, helpId)}
      onChange={(event) => onChange(event.target.value)}
      onBlur={onCommit}
    />
  );
}

/** Any number of its options, each a checkbox in a row; the value keeps the options' order. */
export function MultiChoiceField({
  labelId,
  helpId,
  errorId,
  disabled = false,
  field,
  value,
  onChange,
  onCommit,
}: FieldRendererProps<"multiChoice">) {
  const chosen = new Set(Array.isArray(value) ? value : []);
  return (
    <fieldset
      aria-labelledby={labelId}
      aria-describedby={describedBy(errorId, helpId)}
      className="m-0 flex flex-wrap gap-x-3 gap-y-1 border-0 p-0 text-sm"
    >
      {field.options.map((option) => (
        <label key={option.value} className="flex items-center gap-1.5 has-[:disabled]:opacity-50">
          <input
            type="checkbox"
            className="size-4 accent-primary"
            checked={chosen.has(option.value)}
            disabled={disabled}
            onChange={(event) => {
              const on = event.currentTarget.checked;
              onChange(
                field.options
                  .map((each) => each.value)
                  .filter((each) => (each === option.value ? on : chosen.has(each))),
              );
              onCommit();
            }}
          />
          {option.label}
        </label>
      ))}
    </fieldset>
  );
}

/** One of Media's images, or none, each a radio button showing the image. */
export function ImageChoiceField({
  id,
  labelId,
  helpId,
  errorId,
  field,
  value,
  onChange,
  onCommit,
}: FieldRendererProps<"imageChoice">) {
  const choose = (next: string | undefined) => {
    onChange(next);
    onCommit();
  };
  return (
    <div
      role="radiogroup"
      aria-labelledby={labelId}
      aria-describedby={describedBy(errorId, helpId)}
      className="flex flex-wrap gap-2"
    >
      <ImageChoice
        name={id}
        label={field.noneLabel}
        selected={value === undefined}
        onSelect={() => choose(undefined)}
      />
      {field.options.map((option) => (
        <ImageChoice
          key={option.value}
          name={id}
          label={option.label}
          thumbnail={option.thumbnail}
          selected={value === option.value}
          onSelect={() => choose(option.value)}
        />
      ))}
    </div>
  );
}

/** A form's on/off field: a checkbox with the field's label to its right (dialogs, 2.21). */
export function CheckField({
  id,
  helpId,
  errorId,
  disabled = false,
  field,
  value,
  onChange,
  onCommit,
}: FieldRendererProps<"toggle">) {
  return (
    <label htmlFor={id} className="flex items-center gap-2 text-sm has-[:disabled]:opacity-50">
      <input
        id={id}
        type="checkbox"
        className="size-4 accent-primary"
        checked={value === true}
        disabled={disabled}
        aria-invalid={errorId !== undefined}
        aria-describedby={describedBy(errorId, helpId)}
        onChange={(event) => {
          onChange(event.currentTarget.checked);
          onCommit();
        }}
      />
      {field.label}
    </label>
  );
}
