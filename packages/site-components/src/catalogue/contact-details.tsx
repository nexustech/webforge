import { t } from "@webforge/i18n";
import type { BindableSetting } from "@webforge/model";
import type { ReactNode } from "react";
import { defineSection } from "../frame.js";
import type { ComponentDef } from "../library.js";
import { openingHoursLines } from "../opening-hours.js";
import type { RenderContext } from "../schema.js";
import { BodyText, SectionTitle } from "../typography.js";

const CONTACT_LAYOUTS = ["split", "stacked"] as const;

/** A part's small heading, under the section's title. */
function PartTitle({ children }: { readonly children: ReactNode }) {
  return <SectionTitle size="small">{children}</SectionTitle>;
}

/**
 * A Site Settings value (1.17): the value, else the canvas's hint to fill it in, else (in the
 * export) `null`, so an empty value leaves its line out.
 */
const settingOf = (context: RenderContext, key: BindableSetting): string | ReactNode | null =>
  context.setting(key) ?? context.emptySetting?.(key) ?? null;

/** The business's opening hours, one line for each group of days, and the note under them. */
function Hours({ context }: { readonly context: RenderContext }) {
  const lines = openingHoursLines(context.openingHours ?? [], context.language);
  const note = settingOf(context, "contact.openingHoursNote");
  // Nothing to say in the export without hours or a note; the canvas still shows the note's hint.
  if (lines.length === 0 && note === null) return null;
  return (
    <div className="space-y-3">
      <PartTitle>{t("siteText.openingHours")}</PartTitle>
      {lines.length > 0 && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1">
          {lines.map((line) => (
            <div className="contents" key={`${line.days} ${line.opens}`}>
              <dt className="font-medium">{line.days}</dt>
              <dd>
                <time dateTime={line.opens}>{line.opensText}</time>–
                <time dateTime={line.closes}>{line.closesText}</time>
              </dd>
            </div>
          ))}
        </dl>
      )}
      {note !== null && <p className="text-sm opacity-80">{note}</p>}
    </div>
  );
}

/**
 * One contact detail: its label and its value, a link if `href` gives one. An empty value shows the
 * canvas's hint to fill it in, and leaves the line out of the export.
 */
function Detail({
  label,
  value,
  hint,
  href,
  multiline = false,
}: {
  readonly label: string;
  readonly value: string | undefined;
  readonly hint: ReactNode;
  readonly href?: (value: string) => string;
  readonly multiline?: boolean;
}) {
  if (value === undefined && (hint === undefined || hint === null)) return null;
  return (
    <p>
      <span className="font-medium">{label}: </span>
      {value === undefined ? (
        hint
      ) : multiline ? (
        // A line break for each of the address's lines: the export's formatter joins text lines.
        value
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter((line) => line !== "")
          .flatMap((line, index) => (index === 0 ? [line] : [<br key={index} />, line]))
      ) : href === undefined ? (
        value
      ) : (
        <a className="link" href={href(value)}>
          {value}
        </a>
      )}
    </p>
  );
}

/** The business's address, phone number and email address, each a line when it has one. */
function Contact({ context }: { readonly context: RenderContext }) {
  const detail = (key: "contact.address" | "contact.phone" | "contact.email") => ({
    value: context.setting(key),
    hint: context.emptySetting?.(key),
  });
  return (
    <div className="space-y-3">
      <PartTitle>{t("siteText.contactUs")}</PartTitle>
      <address className="space-y-2 not-italic">
        <Detail label={t("siteText.address")} multiline {...detail("contact.address")} />
        <Detail
          label={t("siteText.phone")}
          {...detail("contact.phone")}
          href={(number) => context.href({ kind: "phone", number, newTab: false })}
        />
        <Detail
          label={t("siteText.email")}
          {...detail("contact.email")}
          href={(address) => context.href({ kind: "email", address, newTab: false })}
        />
      </address>
    </div>
  );
}

/**
 * The business's opening hours and contact details (2.8, S1 item 12), from Site Settings (1.17):
 * typed once there, they change on every page that shows them. The hours are a list of days and
 * times with their note; the contact details are the address, and the phone number and email
 * address as links. Either part can be hidden; they sit side by side on wide screens, or one
 * above the other. An empty value leaves its line out of the export, and shows on the canvas
 * where to fill it in.
 */
const contactDetails = defineSection({
  label: t("section.contactDetails"),
  name: "contact",
  category: t("category.contact"),
  variants: CONTACT_LAYOUTS.map((value) => ({ label: t(`field.contactLayout.${value}`), value })),
  fields: {
    title: { kind: "text", label: t("field.title"), inline: true },
    text: { kind: "richtext", label: t("field.text"), inline: true },
    showHours: { kind: "toggle", label: t("field.showHours"), help: t("field.showHours.help") },
    showContact: {
      kind: "toggle",
      label: t("field.showContact"),
      help: t("field.showContact.help"),
    },
  },
  defaults: {
    title: t("starter.contactDetailsTitle"),
    text: `<p>${t("starter.contactDetailsText")}</p>`,
    showHours: true,
    showContact: true,
  },
  frame: () => "bg-base-100",
  render: ({ values, context }) => {
    const parts = [
      values.showHours ? <Hours key="hours" context={context} /> : null,
      values.showContact ? <Contact key="contact" context={context} /> : null,
    ].filter((part) => part !== null);
    return (
      <div className="mx-auto max-w-4xl space-y-8">
        <div>
          <SectionTitle>{values.title}</SectionTitle>
          <BodyText className="mt-4">{values.text}</BodyText>
        </div>
        {parts.length > 0 && (
          <div
            className={
              values.variant === "split" && parts.length === 2
                ? "grid gap-8 md:grid-cols-2"
                : "space-y-8"
            }
          >
            {parts}
          </div>
        )}
      </div>
    );
  },
});

/** The contact-details family: Opening hours and contact. */
export const contactDetailsComponents: Readonly<Record<string, ComponentDef>> = {
  ContactDetails: contactDetails,
};
