import {
  SITE_DESCRIPTION_MAX,
  type SiteDoc,
  siteSettingsSchema,
  webAddressSchema,
} from "@webforge/model";
import { z } from "zod";

/**
 * The person's own business (QS-2, 3.11): what the quick start asks for besides the name, each
 * optional (QS-6). Its fields are Site Settings' own, checked as Site Settings checks them.
 */
export const businessDetailsSchema = siteSettingsSchema.shape.contact
  .pick({ email: true, phone: true, address: true, openingHours: true })
  .partial()
  .extend({
    /** *What you do*: one line, for Site Settings' description. */
    description: z.string().trim().max(SITE_DESCRIPTION_MAX).optional(),
    /** The site's web address (SEO-9), asked at the quick start's end: Site Settings' address. */
    webAddress: webAddressSchema.optional(),
  });

/** See {@link businessDetailsSchema}. */
export type BusinessDetails = z.infer<typeof businessDetailsSchema>;

/** Escapes text for HTML, as rich text holds it. */
const escapeHtml = (text: string) =>
  text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

/** A phone number as a `tel:` link writes it: its digits, and its leading `+`. */
const dialled = (phone: string) => phone.replace(/[^\d+]/g, "");

/**
 * Makes `site`, a copy of a template's, the person's own (QS-2): its sample business (the name,
 * phone, email and address its Site Settings hold) is replaced by `name` and `business`, in Site
 * Settings and wherever the copy says them, in the pages, the Header and Footer, shared sections
 * and the menu. Text bound to Site Settings follows them by itself. What the person skipped keeps
 * the template's placeholders (QS-6), which Site Check flags before they're published.
 */
export function withBusiness(site: SiteDoc, name: string, business: BusinessDetails): void {
  const { general, contact } = site.settings;
  const replacements: [string, string][] = [[general.name, name]];
  const replace = (sample: string | undefined, value: string | undefined) => {
    if (sample !== undefined && value !== undefined && sample !== value) {
      replacements.push([sample, value]);
    }
  };
  const phone = nonEmpty(business.phone);
  const email = nonEmpty(business.email);
  const address = nonEmpty(business.address);
  replace(contact.phone, phone);
  if (contact.phone !== undefined && phone !== undefined) {
    replace(dialled(contact.phone), dialled(phone));
  }
  replace(contact.email, email);
  replace(contact.address, address);

  general.name = name;
  contact.businessName = name;
  const description = nonEmpty(business.description);
  if (description !== undefined) general.description = description;
  if (phone !== undefined) contact.phone = phone;
  if (email !== undefined) contact.email = email;
  if (address !== undefined) contact.address = address;
  if (business.webAddress !== undefined) {
    site.settings.address.url = business.webAddress.replace(/\/$/, "");
  }
  if (business.openingHours !== undefined && business.openingHours.length > 0) {
    contact.openingHours = structuredClone(business.openingHours);
  }

  // The longest first, so a phone number's spaced form goes before a shorter one inside it.
  const ordered = replacements
    .filter(([sample]) => sample.trim() !== "")
    .sort(([a], [b]) => b.length - a.length);
  const inText = (text: string) => {
    // Rich text is HTML: the sample as it's written there, escaped or not, and the answer escaped.
    const html = /<[a-z][^>]*>/i.test(text);
    let result = text;
    for (const [sample, value] of ordered) {
      if (html) {
        result = result
          .replaceAll(escapeHtml(sample), escapeHtml(value))
          .replaceAll(sample, escapeHtml(value));
      } else {
        result = result.replaceAll(sample, value);
      }
    }
    return result;
  };
  for (const page of Object.values(site.pages)) {
    page.title = inText(page.title);
    if (page.navLabel !== undefined) page.navLabel = inText(page.navLabel);
    if (page.settings.description !== undefined) {
      page.settings.description = inText(page.settings.description);
    }
    replaceStrings(page.doc, inText);
  }
  replaceStrings(site.layout, inText);
  replaceStrings(site.sharedSections, inText);
  replaceStrings(site.menu, inText);
}

/** `text` without its ends' spaces, or `undefined` when nothing is left. */
function nonEmpty(text: string | undefined): string | undefined {
  const trimmed = text?.trim();
  return trimmed === undefined || trimmed === "" ? undefined : trimmed;
}

/** What names rather than says: an element's id and type, its bindings, the ids it refers to. */
const isReference = (key: string) =>
  key === "id" || key === "type" || key === "bindings" || key.endsWith("Id");

/**
 * Replaces every string inside `value` that says something (not a key, and not under a
 * {@link isReference} key) with `change(string)`, in place.
 */
function replaceStrings(value: unknown, change: (text: string) => string): void {
  if (Array.isArray(value)) {
    for (const [index, item] of value.entries()) {
      if (typeof item === "string") value[index] = change(item);
      else replaceStrings(item, change);
    }
  } else if (typeof value === "object" && value !== null) {
    const record = value as Record<string, unknown>;
    for (const [key, item] of Object.entries(record)) {
      if (isReference(key)) continue;
      if (typeof item === "string") record[key] = change(item);
      else replaceStrings(item, change);
    }
  }
}
