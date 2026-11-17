import { t } from "@webforge/i18n";
import { contentWidthClass, defineSection } from "../frame.js";
import { LucideIcon } from "../icons.js";
import type { ComponentDef } from "../library.js";
import type { RenderContext } from "../schema.js";

/** A number with its country code, `+44 7700 900123` or `0044 7700 900123`, as WhatsApp needs. */
const INTERNATIONAL = /^(?:\+|00)\s*[1-9]/;

/** An email address alone, without anything after a `?` or `#` that would add to the message. */
const EMAIL = /^[^\s@?#]+@[^\s@?#]+$/;

/** A phone number's digits, with its leading `+`: what `tel:` needs. */
const dialled = (number: string) => number.replace(/[^0-9+]/g, "");

/** The element's own value, else Site Settings' (`fallback`): empty when neither has one. */
function valueOr(own: string, fallback: string | undefined): string {
  return own.trim() === "" ? (fallback ?? "").trim() : own.trim();
}

/** What each button links to, or `undefined` for a button that isn't shown. */
type ContactLinks = {
  readonly call: string | undefined;
  readonly whatsapp: string | undefined;
  readonly email: string | undefined;
  /** WhatsApp is asked for, without a number it can use: the canvas says what's missing. */
  readonly whatsappMissing: boolean;
};

/** The buttons' links, from the element's own fields and, where they are empty, Site Settings. */
function contactLinks(
  values: {
    readonly call: boolean;
    readonly phone: string;
    readonly whatsapp: boolean;
    readonly whatsappNumber: string;
    readonly email: boolean;
    readonly emailAddress: string;
  },
  context: RenderContext,
): ContactLinks {
  const phone = valueOr(values.phone, context.setting("contact.phone"));
  const whatsapp = valueOr(values.whatsappNumber, phone);
  const email = valueOr(values.emailAddress, context.setting("contact.email"));
  const international = INTERNATIONAL.test(whatsapp);
  return {
    call: values.call && /\d{3}/.test(dialled(phone)) ? `tel:${dialled(phone)}` : undefined,
    // wa.me takes the number with its country code, in digits alone (no `+` or `00`).
    whatsapp:
      values.whatsapp && international
        ? `https://wa.me/${whatsapp.replace(/^00/, "").replace(/\D/g, "")}`
        : undefined,
    email: values.email && EMAIL.test(email) ? `mailto:${email}` : undefined,
    whatsappMissing: values.whatsapp && !international,
  };
}

/** One round button: a plain link, named for screen readers and in its tooltip. */
function ContactButton({
  href,
  name,
  icon,
}: {
  readonly href: string;
  readonly name: string;
  readonly icon: string;
}) {
  return (
    <a
      href={href}
      className="site-contact-button btn btn-circle btn-primary shadow-md"
      aria-label={name}
      title={name}
    >
      <LucideIcon name={icon} className="size-5" />
    </a>
  );
}

/**
 * Contact buttons that stay on screen (6.16d, CC-10): Call, WhatsApp and Email as round buttons,
 * each a plain link (`tel:`, `https://wa.me/…`, `mailto:`), so nothing is asked of anywhere until
 * the visitor taps one. The number and address are Site Settings › Contact's unless the element
 * gives its own; a button without one isn't shown. On the exported site they stay at the screen's
 * bottom left (`RenderContext.pinned`), clear of the back-to-top button at the bottom right and
 * under the cookie banner, which covers them until the visitor chooses. The canvas draws them
 * where they are on the page, after the Footer, so they can be selected. No script.
 */
const contactButtons = defineSection({
  label: t("section.contactButtons"),
  name: "contact-buttons",
  category: t("category.contact"),
  // Buttons only: no title, no background image.
  titled: false,
  background: false,
  fields: {
    call: { kind: "toggle", label: t("field.contactButtons.call") },
    phone: {
      kind: "text",
      label: t("field.contactButtons.phone"),
      help: t("field.contactButtons.phone.help"),
      shownWhen: (values) => values.call === true,
    },
    whatsapp: { kind: "toggle", label: t("field.contactButtons.whatsapp") },
    whatsappNumber: {
      kind: "text",
      label: t("field.contactButtons.whatsappNumber"),
      help: t("field.contactButtons.whatsappNumber.help"),
      shownWhen: (values) => values.whatsapp === true,
    },
    email: { kind: "toggle", label: t("field.contactButtons.email") },
    emailAddress: {
      kind: "text",
      label: t("field.contactButtons.emailAddress"),
      help: t("field.contactButtons.emailAddress.help"),
      shownWhen: (values) => values.email === true,
    },
  },
  defaults: {
    call: true,
    phone: "",
    whatsapp: false,
    whatsappNumber: "",
    email: true,
    emailAddress: "",
    contentWidth: "full",
    // Its buttons only, with no band of its own around them.
    padding: { top: "none", bottom: "none" },
  },
  render: ({ values, context }) => {
    const links = contactLinks(values, context);
    const buttons = [
      links.call === undefined ? null : (
        <ContactButton
          key="call"
          href={links.call}
          name={t("siteText.contactButtons.call")}
          icon="phone"
        />
      ),
      links.whatsapp === undefined ? null : (
        <ContactButton
          key="whatsapp"
          href={links.whatsapp}
          name={t("siteText.contactButtons.whatsapp")}
          icon="message-circle"
        />
      ),
      links.email === undefined ? null : (
        <ContactButton
          key="email"
          href={links.email}
          name={t("siteText.contactButtons.email")}
          icon="mail"
        />
      ),
    ].filter((button) => button !== null);
    // Links with a name, so a screen reader can find the buttons, or skip them.
    const label = t("siteText.contactButtons.label");
    if (context.pinned === true) {
      return buttons.length === 0 ? null : (
        <nav
          aria-label={label}
          // At the bottom left: the back-to-top button is at the bottom right (2.9b), and the
          // cookie banner (z-50) is above them. Not on paper.
          className="fixed bottom-4 left-4 z-40 flex gap-2 print:hidden"
        >
          {buttons}
        </nav>
      );
    }
    const hint = links.whatsappMissing
      ? context.elementHint?.("whatsappNumber")
      : buttons.length === 0
        ? context.elementHint?.("contactButtons")
        : undefined;
    if (buttons.length === 0 && (hint === undefined || hint === null)) return null;
    // At the content width, which only the canvas has: on the site they keep to their corner.
    return (
      <div
        className={`mx-auto ${contentWidthClass(values.contentWidth)} flex flex-col items-start gap-2 px-4 py-4`}
      >
        {buttons.length === 0 ? null : (
          <nav aria-label={label} className="flex gap-2">
            {buttons}
          </nav>
        )}
        {hint}
      </div>
    );
  },
});

/**
 * What goes at the end of the Footer region, after the Footer (6.16d): the Add panel puts Contact
 * buttons there, once, so every page has them, and the canvas deletes them like any section.
 */
export const BELOW_THE_FOOTER: ReadonlySet<string> = new Set(["ContactButtons"]);

/** The Contact buttons family. */
export const contactButtonsComponents: Readonly<Record<string, ComponentDef>> = {
  ContactButtons: contactButtons,
};
