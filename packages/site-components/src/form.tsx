import { t } from "@webforge/i18n";
import type { FormService } from "@webforge/model";
import type { ReactNode } from "react";
import type { FormUnset } from "./schema.js";
import { BUTTON_CLASSES } from "./typography.js";

/**
 * The kinds of field a form can ask for (S1's form fields): a line of text, an email address, a
 * phone number, a message, a tick box, or a choice from a list.
 */
type FormFieldKind = "text" | "email" | "phone" | "message" | "checkbox" | "select";

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
function Honeypot() {
  return (
    <div hidden>
      <label>
        {t("siteText.form.leaveEmpty")}
        <input type="text" name={HONEYPOT_NAME} tabIndex={-1} autoComplete="off" />
      </label>
    </div>
  );
}

/** Where a form sends what the visitor types: a service's address, and fields it needs. */
export type FormTarget = {
  readonly action: string;
  /** Fields the service needs that the visitor never sees, such as an access key. */
  readonly hidden: Readonly<Record<string, string>>;
};

/**
 * `value` as an address a form may post to: `https://` only, so a visitor's details never travel
 * unencrypted, and never a `javascript:` address. `undefined` for anything else. The one check for
 * the Newsletter's address and a custom form service's.
 */
export function httpsAddress(value: unknown): string | undefined {
  if (typeof value !== "string" || value.trim() === "") return undefined;
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" ? url.href : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Where Site Settings' form service takes a form's submissions (F-CM-1, B3): a plain HTML POST to
 * its address, with any field it needs, or why there's nowhere to send: no service, Netlify Forms
 * (which the Netlify publisher adds, 3.7, 4.2), or a custom address that isn't `https://`. 3.7
 * extends this with each service's own honeypot name and its thank-you page.
 *
 * FormSubmit's address is the owner's email address, which is then in the page for anyone to read;
 * FormSubmit gives a random alias instead once the address is confirmed, which Site Check (3.7)
 * suggests using.
 */
export function formAction(service: FormService | undefined): FormTarget | FormUnset {
  switch (service?.kind) {
    case "formspree":
      return { action: `https://formspree.io/f/${service.formId}`, hidden: {} };
    case "web3forms":
      // Web3Forms' access key is public by design: it only lets the form send to the owner.
      return {
        action: "https://api.web3forms.com/submit",
        hidden: { access_key: service.accessKey },
      };
    case "formsubmit":
      return { action: `https://formsubmit.co/${encodeURIComponent(service.email)}`, hidden: {} };
    case "custom": {
      const action = httpsAddress(service.url);
      return action === undefined ? "insecure" : { action, hidden: {} };
    }
    case "netlify":
      return "netlify";
    default:
      return "noService";
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
      <Honeypot />
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
