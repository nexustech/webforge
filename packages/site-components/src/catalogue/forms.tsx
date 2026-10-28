import { t } from "@webforge/i18n";
import { httpsAddress, type NodeDoc, newsletterUnset } from "@webforge/model";
import { createContext, type ReactNode, useContext } from "react";
import { defineComponent } from "../define.js";
import {
  addressTarget,
  FORM_FIELD_KINDS,
  FormField,
  type FormFieldKind,
  type FormTarget,
  formAction,
  SiteForm,
} from "../form.js";
import { defineSection, MARGIN_FIELD, marginClasses } from "../frame.js";
import type { ComponentDef } from "../library.js";
import {
  ENTRANCE_FIELDS,
  entranceAttributes,
  entranceBehaviours,
  entranceClasses,
} from "../motion.js";
import type { FormUnset } from "../schema.js";
import { SectionIntro, SectionTitle } from "../typography.js";

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
          <SectionIntro className="mt-4">{text}</SectionIntro>
        </div>
        {form}
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-xl space-y-8">
      <div className="text-center">
        <SectionTitle>{title}</SectionTitle>
        <SectionIntro className="mt-4">{text}</SectionIntro>
      </div>
      {form}
    </div>
  );
}

/** A field name a newsletter service may use (`EMAIL`, `fields[email]`); `email` for any other. */
export function emailFieldName(value: unknown): string {
  const text = plainText(value);
  return text !== undefined && /^[A-Za-z0-9_.[\]-]{1,64}$/.test(text) ? text : "email";
}

/** Where a Newsletter posts: its own form address, if it is an `https://` one. */
function newsletterTarget(value: unknown): FormTarget | FormUnset {
  const action = httpsAddress(value);
  return action === undefined ? (newsletterUnset(value) ?? "insecure") : addressTarget(action);
}

/**
 * A contact form (F-CM-1): a name, an email address, a phone number if asked, and a message, sent
 * to the form service chosen in Site Settings (B3) as a plain HTML POST, with the honeypot (B6).
 * Without a service it draws and sends nowhere, and the canvas says where to choose one.
 */
const contactForm = defineSection({
  label: t("section.contactForm"),
  name: "contact-form",
  // The check that a robot didn't send it at once (3.7, B6).
  behaviours: ["form"],
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
          target={formAction(context.formService, context.thanksPage)}
          label={t("siteText.form.contact")}
          submitLabel={plainText(values.buttonLabel) ?? t("starter.contactFormButton")}
          hint={context.formHint}
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
  behaviours: ["form"],
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
  render: ({ id, values, context }) => (
    <FormSection
      layout={values.variant}
      title={values.title}
      text={values.text}
      form={
        <SiteForm
          target={newsletterTarget(values.action)}
          hint={context.formHint}
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

/**
 * What a form field's submission is called, before it is made unique in its form: `email` for an
 * email address (form services reply to it), else its label in plain letters and digits
 * ("Téléphone" is `telephone`), or `field-<position>` for a label with none of those ("電話").
 */
export function fieldNameBase(kind: FormFieldKind, label: string, position: number): string {
  if (kind === "email") return "email";
  const plain = label
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return plain === "" ? `field-${position}` : plain;
}

/**
 * The names of a form's fields (2.11): each field claims one as it is drawn, in the form's order,
 * made unique in the form (`name`, `name-2`). A field keeps its name while its label and kind do,
 * if it is drawn again alone (on the canvas). Its `id` is the form's id and its name, unique on
 * the page.
 */
export function createFieldNames(formId: string) {
  const claimed = new Map<string, { readonly base: string; readonly name: string }>();
  return {
    claim(nodeId: string, kind: FormFieldKind, label: string): { name: string; id: string } {
      const known = claimed.get(nodeId);
      const position =
        known === undefined ? claimed.size + 1 : [...claimed.keys()].indexOf(nodeId) + 1;
      const base = fieldNameBase(kind, label, position);
      if (known === undefined || known.base !== base) {
        const taken = new Set(
          [...claimed].filter(([other]) => other !== nodeId).map(([, each]) => each.name),
        );
        let name = base;
        for (let count = 2; taken.has(name); count += 1) name = `${base}-${count}`;
        claimed.set(nodeId, { base, name });
      }
      const name = claimed.get(nodeId)?.name ?? base;
      return { name, id: `${formId}-${name}` };
    },
  };
}

/** The names of the form a field is drawn in: none outside a Form, which a field never is. */
const FieldNames = createContext(createFieldNames("form"));

/** A Form field as its Form draws it: its name and id claimed in its form, then 2.8's field. */
function FormFieldElement({
  nodeId,
  kind,
  label,
  required,
  options,
}: {
  readonly nodeId: string;
  readonly kind: FormFieldKind;
  readonly label: string;
  readonly required: boolean;
  readonly options: readonly string[];
}) {
  const { name, id } = useContext(FieldNames).claim(nodeId, kind, label);
  return (
    <FormField
      kind={kind}
      name={name}
      id={id}
      label={label === "" ? t("siteText.form.untitled") : label}
      required={required}
      options={options}
    />
  );
}

/**
 * A field of a Form (2.11, S1's form fields): a line of text, an email address, a phone number, a
 * message, a tick box or a choice from a list, with its label, and required if asked (marked, and
 * checked by the browser). Drawn by 2.8's form module, as the form sections' fields are.
 */
const formField = defineComponent({
  label: t("element.formField"),
  place: "child",
  fields: {
    kind: {
      kind: "select",
      label: t("field.formFieldKind"),
      options: FORM_FIELD_KINDS.map((value) => ({
        label: t(`field.formFieldKind.${value}`),
        value,
      })),
    },
    label: { kind: "text", label: t("field.formFieldLabel") },
    required: { kind: "toggle", label: t("field.formFieldRequired") },
    options: {
      kind: "list",
      label: t("field.formFieldOptions"),
      itemLabel: t("field.formFieldOption"),
      fields: { label: { kind: "text", label: t("field.formFieldOption") } },
      defaults: { label: "" },
    },
  },
  defaults: { kind: "text", label: t("starter.formFieldLabel"), required: false, options: [] },
  render: ({ id, values }) => (
    <FormFieldElement
      nodeId={id}
      kind={values.kind}
      label={values.label.trim()}
      required={values.required}
      options={values.options.flatMap((item) => {
        const text = typeof item.label === "string" ? item.label.trim() : "";
        return text === "" ? [] : [text];
      })}
    />
  ),
});

/** A starter field of a new Form. */
const starterField = (id: string, kind: FormFieldKind, label: string): NodeDoc => ({
  type: "FormField",
  props: { id, kind, label, required: true, options: [] },
});

/**
 * A form of fields of one's own (2.11, F-CM-1): any of the Form fields, in order, sent to the form
 * service chosen in Site Settings (B3) as a plain HTML POST with the honeypot (B6), as the Contact
 * form section is. Without a service it draws and sends nowhere, and the canvas says where to
 * choose one. A new one asks for a name, an email address and a message.
 */
const form = defineComponent({
  label: t("element.form"),
  category: t("category.contact"),
  fields: {
    fields: { kind: "slot", label: t("field.formFields"), allow: ["FormField"] },
    label: { kind: "text", label: t("field.formLabel"), help: t("field.formLabel.help") },
    buttonLabel: { kind: "text", label: t("field.buttonLabel") },
    margin: MARGIN_FIELD,
    ...ENTRANCE_FIELDS,
  },
  defaults: {
    fields: [
      starterField("form-name", "text", t("siteText.form.name")),
      starterField("form-email", "email", t("siteText.form.email")),
      starterField("form-message", "message", t("siteText.form.message")),
    ],
    label: t("starter.formLabel"),
    buttonLabel: t("starter.formButton"),
  },
  behaviours: (values) => [...entranceBehaviours(values), "form"],
  render: ({ id, values, slots, context }) => {
    const Fields = slots.fields;
    return (
      <div
        className={`site-form-element${marginClasses(values.margin)}${entranceClasses(values)}`}
        {...entranceAttributes(values)}
      >
        <FieldNames value={createFieldNames(id)}>
          <SiteForm
            target={formAction(context.formService, context.thanksPage)}
            label={plainText(values.label) ?? t("starter.formLabel")}
            submitLabel={plainText(values.buttonLabel) ?? t("starter.formButton")}
            hint={context.formHint}
          >
            <Fields className="space-y-4" />
          </SiteForm>
        </FieldNames>
      </div>
    );
  },
});

/** The forms family: sections and a Form element that send what a visitor types to a form service. */
export const formsComponents: Readonly<Record<string, ComponentDef>> = {
  ContactForm: contactForm,
  Newsletter: newsletter,
  Form: form,
  FormField: formField,
};
