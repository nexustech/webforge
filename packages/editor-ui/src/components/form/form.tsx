import { type ReactNode, useId } from "react";
import { cn } from "../../lib/cn.js";
import { fieldControlClass } from "../edit/text-field.js";

/**
 * What a form control gets from its {@link Field}: the id its label points at, and what describes
 * it (the hint, then the error) and marks it invalid while there is an error.
 */
export type FieldControlProps = {
  readonly id: string;
  readonly "aria-describedby"?: string;
  readonly "aria-invalid"?: true;
};

/** The DOM ids of a {@link Field}'s label, and of its hint and error while it shows them. */
export type FieldIds = {
  readonly labelId: string;
  readonly hintId?: string;
  readonly errorId?: string;
};

/** Props of {@link Field}. */
export type FieldProps = {
  /** Already translated; none for a control that labels itself (a form's checkbox). */
  readonly label?: string | undefined;
  /** A line under the control that says what to type; already translated. */
  readonly hint?: string | undefined;
  /** What to fix, if anything (already translated): shown under the control, which it describes. */
  readonly error?: string | undefined;
  /**
   * Draws the control, spreading `control` on it so the label, hint and error belong to it. A
   * group of controls (radios, a field renderer of the Edit panel) is named by `labelId` instead,
   * with `aria-labelledby`; a field renderer is described by the hint's and error's ids in `ids`.
   */
  readonly children: (control: FieldControlProps, ids: FieldIds) => ReactNode;
};

/**
 * A labelled form field (dialogs: Page Settings, Site Settings, links): the label, the control the
 * field draws, its error and its hint. The form engine of plan item 2.21 draws its fields with it.
 */
export function Field({ label, hint, error, children }: FieldProps) {
  const id = useId();
  const labelId = useId();
  const hintId = useId();
  const errorId = useId();
  const describedBy = [
    hint === undefined ? undefined : hintId,
    error === undefined ? undefined : errorId,
  ].filter((part) => part !== undefined);
  return (
    <div className="grid gap-1">
      {label === undefined ? null : (
        <label id={labelId} htmlFor={id} className="text-xs text-muted-foreground">
          {label}
        </label>
      )}
      {children(
        {
          id,
          ...(describedBy.length === 0 ? {} : { "aria-describedby": describedBy.join(" ") }),
          ...(error === undefined ? {} : { "aria-invalid": true }),
        },
        {
          labelId,
          ...(hint === undefined ? {} : { hintId }),
          ...(error === undefined ? {} : { errorId }),
        },
      )}
      <ErrorText id={errorId} message={error} />
      {hint !== undefined && (
        <p id={hintId} className="m-0 text-xs text-muted-foreground">
          {hint}
        </p>
      )}
    </div>
  );
}

/** A field's error, if it has one; `id` is what its control's `aria-describedby` names. */
export function ErrorText({
  id,
  message,
}: {
  readonly id?: string;
  readonly message?: string | undefined;
}) {
  return message === undefined ? null : (
    <p id={id} className="m-0 text-xs text-destructive-text">
      {message}
    </p>
  );
}

/** Props of {@link TextInput}. */
export type TextInputProps = Omit<FieldProps, "children" | "label"> & {
  /** Already translated. */
  readonly label: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  /** The longest text the field takes: the model's limit for it. */
  readonly maxLength?: number;
  readonly type?: "text" | "email" | "tel" | "url";
  /** Several lines, for a description or a postal address. */
  readonly multiline?: boolean;
  readonly placeholder?: string;
  readonly disabled?: boolean;
  /** Save stays off while it is empty (the form checks it). */
  readonly required?: boolean;
};

/** A labelled text field, on one line or several, with its hint and error. */
export function TextInput({
  value,
  onChange,
  maxLength,
  type = "text",
  multiline = false,
  placeholder,
  disabled,
  required,
  ...field
}: TextInputProps) {
  const shared = {
    value,
    ...(maxLength === undefined ? {} : { maxLength }),
    ...(placeholder === undefined ? {} : { placeholder }),
    ...(disabled === undefined ? {} : { disabled }),
    ...(required === undefined ? {} : { required }),
  };
  return (
    <Field {...field}>
      {(control) =>
        multiline ? (
          <textarea
            {...control}
            {...shared}
            className={cn(fieldControlClass, "h-16 resize-none py-1")}
            onChange={(event) => onChange(event.currentTarget.value)}
          />
        ) : (
          <input
            {...control}
            {...shared}
            type={type}
            className={fieldControlClass}
            onChange={(event) => onChange(event.currentTarget.value)}
          />
        )
      }
    </Field>
  );
}

/** A checkbox with its label to the right. */
export function Check({
  label,
  checked,
  onChange,
  disabled,
}: {
  /** Already translated. */
  readonly label: string;
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
  readonly disabled?: boolean;
}) {
  return (
    <label className="flex items-center gap-2 text-sm has-[:disabled]:opacity-50">
      <input
        type="checkbox"
        className="size-4 accent-primary"
        checked={checked}
        {...(disabled === undefined ? {} : { disabled })}
        onChange={(event) => onChange(event.currentTarget.checked)}
      />
      {label}
    </label>
  );
}

/**
 * One time of day, `HH:MM`, labelled inline ("Opens 09:00"), with its error: a row of opening
 * hours has two.
 */
export function TimeInput({
  label,
  value,
  error,
  onChange,
}: {
  /** Already translated. */
  readonly label: ReactNode;
  readonly value: string;
  /** What to fix, if anything; already translated. */
  readonly error?: string | undefined;
  readonly onChange: (value: string) => void;
}) {
  const errorId = useId();
  // The error sits beside the label, not in it: it describes the time, and is no part of its name.
  return (
    <div className="flex flex-col gap-0.5 text-muted-foreground">
      <label className="flex items-center gap-1.5">
        {label}
        <input
          type="time"
          // Wide enough for a 12-hour clock ("07:00 AM") as well as a 24-hour one.
          className={cn(fieldControlClass, "w-32")}
          value={value}
          {...(error === undefined ? {} : { "aria-invalid": true, "aria-describedby": errorId })}
          onChange={(event) => onChange(event.currentTarget.value)}
        />
      </label>
      <ErrorText id={errorId} message={error} />
    </div>
  );
}

/**
 * One choice of image: a radio button showing the image, or the default (no `thumbnail`). `name`
 * groups the choices of one picker, so a form can have several.
 */
export function ImageChoice({
  label,
  thumbnail,
  selected,
  onSelect,
  name,
}: {
  /** Already translated. */
  readonly label: string;
  readonly thumbnail?: string;
  readonly selected: boolean;
  readonly onSelect: () => void;
  readonly name: string;
}) {
  return (
    <label
      className={cn(
        "flex w-20 cursor-pointer flex-col items-center gap-1 rounded-sm border border-border p-1 text-center text-xs",
        "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
        selected && "border-primary bg-accent text-accent-foreground",
      )}
    >
      <input type="radio" name={name} className="sr-only" checked={selected} onChange={onSelect} />
      {thumbnail === undefined ? (
        <span
          className="flex size-12 items-center justify-center rounded-sm bg-input"
          aria-hidden
        />
      ) : (
        <img src={thumbnail} alt="" className="size-12 rounded-sm object-cover" />
      )}
      <span className="line-clamp-2 break-all">{label}</span>
    </label>
  );
}
