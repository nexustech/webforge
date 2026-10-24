import { t } from "@webforge/i18n";
import type { ReactNode } from "react";
import { BUTTON_CLASSES } from "./typography.js";

/**
 * The kinds of field a form can ask for (S1's form fields): a line of text, an email address, a
 * phone number, a message, a tick box, or a choice from a list.
 */
export type FormFieldKind = "text" | "email" | "phone" | "message" | "checkbox" | "select";

/** What each kind asks the browser for: its input type, and what it may fill in. */
const INPUT: Readonly<
  Record<Exclude<FormFieldKind, "message" | "checkbox" | "select">, { type: string; fill: string }>
> = {
  text: { type: "text", fill: "on" },
  email: { type: "email", fill: "email" },
  phone: { type: "tel", fill: "tel" },
};

/** One field of a form, as a site's form shows it (shared by the form sections and 2.11's elements). */
export type FormFieldProps = {
  readonly kind: FormFieldKind;
  /** What the submission calls it ("email"): what the form service receives. */
  readonly name: string;
  /** What the visitor reads, already translated. */
  readonly label: string;
  /** Unique on the page: the form's id, then the field's name ("contact-email"). */
  readonly id: string;
  readonly required?: boolean;
  /** What the browser may fill in from the visitor's details ("name"), if not the kind's own. */
  readonly autoComplete?: string;
  /** A select's choices, in order. */
  readonly options?: readonly string[];
};

/** The label's text, with a mark a screen reader skips when the field is required. */
function LabelText({ label, required }: { readonly label: string; readonly required: boolean }) {
  return (
    <>
      {label}
      {required && (
        <span className="text-error" aria-hidden="true">
          {" *"}
        </span>
      )}
    </>
  );
}

/**
 * A form field with its label, in daisyUI's form classes: plain HTML the browser checks itself
 * (`required`, `type="email"`), so it works without JavaScript.
 */
export function FormField({
  kind,
  name,
  label,
  id,
  required = false,
  autoComplete,
  options = [],
}: FormFieldProps) {
  if (kind === "checkbox") {
    return (
      <label className="site-form-field flex items-start gap-3" htmlFor={id}>
        <input id={id} name={name} type="checkbox" className="checkbox mt-1" required={required} />
        <span>
          <LabelText label={label} required={required} />
        </span>
      </label>
    );
  }
  let control: ReactNode;
  if (kind === "message") {
    control = (
      <textarea id={id} name={name} rows={5} className="textarea w-full" required={required} />
    );
  } else if (kind === "select") {
    control = (
      <select id={id} name={name} className="select w-full" required={required} defaultValue="">
        <option value="" disabled>
          {t("siteText.form.choose")}
        </option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    );
  } else {
    const input = INPUT[kind];
    control = (
      <input
        id={id}
        name={name}
        type={input.type}
        className="input w-full"
        required={required}
        autoComplete={autoComplete ?? input.fill}
      />
    );
  }
  return (
    <div className="site-form-field space-y-1">
      <label className="block font-medium" htmlFor={id}>
        <LabelText label={label} required={required} />
      </label>
      {control}
    </div>
  );
}

/**
 * The name of the field people never see but spam robots fill in (B6): a submission with it filled
 * is spam. Formspree drops such submissions itself; 3.7 gives each other service its own name.
 */
export const HONEYPOT_NAME = "_gotcha";

/**
 * The honeypot (B6): a field hidden from visitors, screen readers and the keyboard, which robots
 * that fill in every field fill in too.
 */
export function Honeypot() {
  return (
    <div hidden>
      <label>
        {t("siteText.form.leaveEmpty")}
        <input type="text" name={HONEYPOT_NAME} tabIndex={-1} autoComplete="off" />
      </label>
    </div>
  );
}

/**
 * A form that posts its fields to `action`, a form service's address (F-CM-1, F-CM-6): plain HTML,
 * no script, the honeypot included. Without an address it still draws, posting nowhere, so the
 * person sees it while choosing a service; the export's checks (3.7) say it isn't set up yet.
 */
export function SiteForm({
  action,
  label,
  submitLabel,
  hidden = {},
  children,
  className,
}: {
  readonly action: string | undefined;
  /** What the form is for, for screen readers ("Contact form"). */
  readonly label: string;
  readonly submitLabel: string;
  /** Fields a service needs that the visitor never sees, such as an access key. */
  readonly hidden?: Readonly<Record<string, string>>;
  readonly children: ReactNode;
  readonly className?: string;
}) {
  return (
    <form
      className={`site-form space-y-4${className === undefined ? "" : ` ${className}`}`}
      method="post"
      acceptCharset="UTF-8"
      aria-label={label}
      {...(action === undefined ? {} : { action })}
    >
      {Object.entries(hidden).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      {children}
      <Honeypot />
      <button type="submit" className={BUTTON_CLASSES.primary}>
        {submitLabel}
      </button>
    </form>
  );
}
