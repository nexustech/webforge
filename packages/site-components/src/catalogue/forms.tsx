import { t } from "@webforge/i18n";
import type { ReactNode } from "react";
import { FormField, type FormTarget, formAction, SiteForm } from "../form.js";
import { defineSection } from "../frame.js";
import type { ComponentDef } from "../library.js";
import { BodyText, SectionTitle } from "../typography.js";

const FORM_LAYOUTS = ["stacked", "split"] as const;
const layoutVariants = FORM_LAYOUTS.map((value) => ({
  label: t(`field.formLayout.${value}`),
  value,
}));

/** `value` as text, if it is some: what a plain text field holds in the export. */
const plainText = (value: unknown) =>
  typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;

/**
 * A section's title and text, and its form: above it, centred (`stacked`), or beside it on wide
 * screens (`split`).
 */
function FormSection({
  layout,
  title,
  text,
  form,
}: {
  readonly layout: (typeof FORM_LAYOUTS)[number];
  readonly title: ReactNode;
  readonly text: ReactNode;
  readonly form: ReactNode;
}) {
  if (layout === "split") {
    return (
      <div className="mx-auto grid max-w-6xl items-start gap-10 md:grid-cols-2">
        <div>
          <SectionTitle>{title}</SectionTitle>
          <BodyText className="mt-4">{text}</BodyText>
        </div>
        {form}
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-xl space-y-8">
      <div className="text-center">
        <SectionTitle>{title}</SectionTitle>
        <BodyText className="mt-4">{text}</BodyText>
      </div>
      {form}
    </div>
  );
}

/**
 * A web address a form can post to: `https://` only, so a visitor's details never go unencrypted,
 * and never a `javascript:` address. `undefined` for anything else.
 */
export function formAddress(value: unknown): string | undefined {
  const text = plainText(value);
  if (text === undefined) return undefined;
  try {
    const url = new URL(text);
    return url.protocol === "https:" ? url.href : undefined;
  } catch {
    return undefined;
  }
}

/** A field name a newsletter service may use (`EMAIL`, `fields[email]`); `email` for any other. */
export function emailFieldName(value: unknown): string {
  const text = plainText(value);
  return text !== undefined && /^[A-Za-z0-9_.[\]-]{1,64}$/.test(text) ? text : "email";
}

/** Where a Newsletter posts: its own form address, if it is an `https://` one. */
function newsletterTarget(value: unknown): FormTarget | undefined {
  const action = formAddress(value);
  return action === undefined ? undefined : { action, hidden: {} };
}

/**
 * A contact form (F-CM-1): a name, an email address, a phone number if asked, and a message, sent
 * to the form service chosen in Site Settings (B3) as a plain HTML POST, with the honeypot (B6).
 * Without a service it draws and sends nowhere, and the canvas says where to choose one.
 */
const contactForm = defineSection({
  label: t("section.contactForm"),
  name: "contact-form",
  category: t("category.contact"),
  variants: layoutVariants,
  fields: {
    title: { kind: "text", label: t("field.title"), inline: true },
    text: { kind: "richtext", label: t("field.text"), inline: true },
    askPhone: { kind: "toggle", label: t("field.askPhone") },
    buttonLabel: { kind: "text", label: t("field.buttonLabel") },
  },
  defaults: {
    title: t("starter.contactFormTitle"),
    text: `<p>${t("starter.contactFormText")}</p>`,
    askPhone: false,
    buttonLabel: t("starter.contactFormButton"),
  },
  frame: () => "bg-base-100",
  render: ({ id, values, context }) => (
    <FormSection
      layout={values.variant}
      title={values.title}
      text={values.text}
      form={
        <SiteForm
          target={formAction(context.formService)}
          label={t("siteText.form.contact")}
          submitLabel={plainText(values.buttonLabel) ?? t("starter.contactFormButton")}
          unsetHint={context.emptyFormService}
        >
          <FormField
            kind="text"
            name="name"
            label={t("siteText.form.name")}
            id={`${id}-name`}
            autoComplete="name"
            required
          />
          <FormField
            kind="email"
            name="email"
            label={t("siteText.form.email")}
            id={`${id}-email`}
            required
          />
          {values.askPhone && (
            <FormField
              kind="phone"
              name="phone"
              label={t("siteText.form.phone")}
              id={`${id}-phone`}
            />
          )}
          <FormField
            kind="message"
            name="message"
            label={t("siteText.form.message")}
            id={`${id}-message`}
            required
          />
        </SiteForm>
      }
    />
  ),
});

/**
 * A newsletter signup (F-CM-6, G17): an email address, and a name if asked, posted to the address
 * the newsletter service gives its own signup form. No service is built in (GA3); the honeypot
 * comes with it. An address that isn't `https://` posts nowhere.
 */
const newsletter = defineSection({
  label: t("section.newsletter"),
  name: "newsletter",
  category: t("category.contact"),
  variants: layoutVariants,
  fields: {
    title: { kind: "text", label: t("field.title"), inline: true },
    text: { kind: "richtext", label: t("field.text"), inline: true },
    askName: { kind: "toggle", label: t("field.askName") },
    buttonLabel: { kind: "text", label: t("field.buttonLabel") },
    action: { kind: "text", label: t("field.formAddress"), help: t("field.formAddress.help") },
    emailName: {
      kind: "text",
      label: t("field.emailFieldName"),
      help: t("field.emailFieldName.help"),
    },
  },
  defaults: {
    title: t("starter.newsletterTitle"),
    text: `<p>${t("starter.newsletterText")}</p>`,
    askName: false,
    buttonLabel: t("starter.newsletterButton"),
    action: "",
    emailName: "email",
  },
  frame: () => "bg-base-200",
  render: ({ id, values }) => (
    <FormSection
      layout={values.variant}
      title={values.title}
      text={values.text}
      form={
        <SiteForm
          target={newsletterTarget(values.action)}
          label={t("siteText.form.newsletter")}
          submitLabel={plainText(values.buttonLabel) ?? t("starter.newsletterButton")}
        >
          {values.askName && (
            <FormField
              kind="text"
              name="name"
              label={t("siteText.form.name")}
              id={`${id}-name`}
              autoComplete="name"
            />
          )}
          <FormField
            kind="email"
            name={emailFieldName(values.emailName)}
            label={t("siteText.form.email")}
            id={`${id}-email`}
            required
          />
        </SiteForm>
      }
    />
  ),
});

/** The forms family: sections that send what a visitor types to a form service. */
export const formsComponents: Readonly<Record<string, ComponentDef>> = {
  ContactForm: contactForm,
  Newsletter: newsletter,
};
