import { t } from "@webforge/i18n";
import { type FormService, formServiceUnset, httpsAddress, THANKS_FIELD } from "@webforge/model";
import type { ReactNode } from "react";
import type { FormUnset } from "./schema.js";
import { BUTTON_CLASSES } from "./typography.js";

/**
 * The kinds of field a form can ask for (S1's form fields): a line of text, an email address, a
 * phone number, a message, a tick box, or a choice from a list.
 */
export const FORM_FIELD_KINDS = [
  "text",
  "email",
  "phone",
  "message",
  "checkbox",
  "select",
] as const;
export type FormFieldKind = (typeof FORM_FIELD_KINDS)[number];

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

/** `aria-required` with `required`: said by every screen reader, as the browser checks it. */
const requiredAttributes = (required: boolean) => (required ? { "aria-required": true } : {});

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
        <input
          id={id}
          name={name}
          type="checkbox"
          className="checkbox mt-1"
          required={required}
          {...requiredAttributes(required)}
        />
        <span>
          <LabelText label={label} required={required} />
        </span>
      </label>
    );
  }
  let control: ReactNode;
  if (kind === "message") {
    control = (
      <textarea
        id={id}
        name={name}
        rows={5}
        className="textarea w-full"
        required={required}
        {...requiredAttributes(required)}
      />
    );
  } else if (kind === "select") {
    control = (
      <select
        id={id}
        name={name}
        className="select w-full"
        required={required}
        defaultValue=""
        {...requiredAttributes(required)}
      >
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
        {...requiredAttributes(required)}
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
 * The field people never see but spam robots fill in (B6), named as the form's service reads it: a
 * submission with it filled is dropped as spam. Web3Forms asks for a checkbox.
 */
type Honeypot = { readonly name: string; readonly checkbox?: true };

/** Formspree's honeypot, which a custom endpoint and a Newsletter's address get too. */
const GOTCHA: Honeypot = { name: "_gotcha" };

/** Each service's own honeypot (3.7, B6). */
const HONEYPOTS = {
  formspree: GOTCHA,
  web3forms: { name: "botcheck", checkbox: true },
  formsubmit: { name: "_honey" },
  custom: GOTCHA,
} as const satisfies Readonly<Record<string, Honeypot>>;

/**
 * The honeypot (B6): a field hidden from visitors, screen readers and the keyboard, which robots
 * that fill in every field fill in too.
 */
function HoneypotField({ honeypot }: { readonly honeypot: Honeypot }) {
  return (
    <div hidden>
      <label>
        {t("siteText.form.leaveEmpty")}
        <input
          type={honeypot.checkbox === true ? "checkbox" : "text"}
          name={honeypot.name}
          tabIndex={-1}
          {...(honeypot.checkbox === true ? {} : { autoComplete: "off" })}
        />
      </label>
    </div>
  );
}

/** Where a form sends what the visitor types: a service's address, and fields it needs. */
export type FormTarget = {
  readonly action: string;
  /** Fields the service needs that the visitor never sees, such as an access key. */
  readonly hidden: Readonly<Record<string, string>>;
  /** The honeypot, named as the service reads it (B6). */
  readonly honeypot: Honeypot;
};

/** `address` as a form's target, Formspree's honeypot with it: a Newsletter's own address. */
export const addressTarget = (address: string): FormTarget => ({
  action: address,
  hidden: {},
  honeypot: GOTCHA,
});

/**
 * Where Site Settings' form service takes a form's submissions (F-CM-1, B3): a plain HTML POST to
 * its address, with the fields it needs and its own honeypot (B6), or why there's nowhere to send
 * (the model's `formServiceUnset`). With `thanksPage`, the address of the site's thank-you page,
 * the services that can send the visitor there after sending are told to (`THANKS_FIELD`, 3.7).
 *
 * FormSubmit's address is the owner's email address, which is then in the page for anyone to read;
 * FormSubmit gives a random alias instead once the address is confirmed.
 */
export function formAction(
  service: FormService | undefined,
  thanksPage?: string,
): FormTarget | FormUnset {
  const unset = formServiceUnset(service);
  if (unset !== undefined || service === undefined) return unset ?? "noService";
  const thanksField = THANKS_FIELD[service.kind];
  const thanks =
    thanksField === undefined || thanksPage === undefined ? {} : { [thanksField]: thanksPage };
  switch (service.kind) {
    case "formspree":
      return {
        action: `https://formspree.io/f/${service.formId}`,
        hidden: {},
        honeypot: HONEYPOTS.formspree,
      };
    case "web3forms":
      // Web3Forms' access key is public by design: it only lets the form send to the owner.
      return {
        action: "https://api.web3forms.com/submit",
        hidden: { access_key: service.accessKey, ...thanks },
        honeypot: HONEYPOTS.web3forms,
      };
    case "formsubmit":
      return {
        action: `https://formsubmit.co/${encodeURIComponent(service.email)}`,
        hidden: thanks,
        honeypot: HONEYPOTS.formsubmit,
      };
    case "custom":
      return {
        action: httpsAddress(service.url) ?? "",
        hidden: {},
        honeypot: HONEYPOTS.custom,
      };
    default:
      return "netlify";
  }
}

/**
 * A form that posts its fields to `target`, a form service (F-CM-1, F-CM-6): plain HTML, no
 * script, the honeypot included. When `target` says why there's nowhere to send, the form still
 * draws, so the person sees it while setting it up, but has no `action` and its button is
 * disabled: it would post to the page itself, and a static host would answer with an error page
 * and lose the visitor's message. It is marked `data-wf-form-unset` with the reason, for Site
 * Check (3.7); `hint` says on the canvas what to do.
 */
export function SiteForm({
  target,
  label,
  submitLabel,
  hint,
  children,
  className,
}: {
  readonly target: FormTarget | FormUnset;
  /** What the form is for, for screen readers ("Contact form"). */
  readonly label: string;
  readonly submitLabel: string;
  /** What a form that can't send shows: a hint on the canvas (`formHint`), nothing in the export. */
  readonly hint?: ((reason: FormUnset) => ReactNode) | undefined;
  readonly children: ReactNode;
  readonly className?: string;
}) {
  const unset = typeof target === "string" ? target : undefined;
  const hidden = typeof target === "string" ? {} : target.hidden;
  const shownHint = unset === undefined ? undefined : hint?.(unset);
  return (
    <form
      className={`site-form space-y-4${className === undefined ? "" : ` ${className}`}`}
      method="post"
      acceptCharset="UTF-8"
      aria-label={label}
      {...(typeof target === "string"
        ? { "data-wf-form-unset": target }
        : { action: target.action })}
    >
      {shownHint !== undefined && shownHint !== null && <p className="text-sm">{shownHint}</p>}
      {Object.entries(hidden).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      {children}
      <HoneypotField honeypot={typeof target === "string" ? GOTCHA : target.honeypot} />
      {/* Without a target the form would post to the page itself and lose the message: no send. */}
      <button
        type="submit"
        className={BUTTON_CLASSES.primary}
        {...(unset === undefined ? {} : { disabled: true })}
      >
        {submitLabel}
      </button>
    </form>
  );
}
