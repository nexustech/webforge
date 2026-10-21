import { t } from "@webforge/i18n";
import {
  type MediaId,
  type SiteSettings,
  type SOCIAL_NETWORKS,
  siteSettingsSchema,
} from "@webforge/model";
import type { EditorSession } from "../editor/editor-session.js";

/** The days of the week, in the order the dialog shows them. */
export const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

/** A day of the week. */
type Day = (typeof DAYS)[number];

/** Where forms send submissions by default (B3, B6); `""` is none chosen yet. */
export const FORM_SERVICES = [
  "",
  "formspree",
  "web3forms",
  "formsubmit",
  "netlify",
  "custom",
] as const;

/** A form service, or `""` for none. */
export type FormServiceKind = (typeof FORM_SERVICES)[number];

/**
 * What the Site Settings dialog edits: every value as the user types it (empty strings for empty
 * fields), so the form can hold invalid input until Save checks it.
 */
export type SettingsForm = {
  readonly name: string;
  readonly description: string;
  readonly language: string;
  readonly icon: MediaId | undefined;
  readonly url: string;
  readonly profiles: readonly {
    readonly network: (typeof SOCIAL_NETWORKS)[number];
    readonly url: string;
  }[];
  readonly shareImage: MediaId | undefined;
  readonly xHandle: string;
  readonly businessName: string;
  readonly email: string;
  readonly phone: string;
  readonly address: string;
  readonly openingHours: readonly {
    readonly days: readonly Day[];
    readonly opens: string;
    readonly closes: string;
  }[];
  readonly openingHoursNote: string;
  readonly allowIndexing: boolean;
  readonly includeSitemap: boolean;
  readonly measurementId: string;
  readonly consentBanner: boolean;
  readonly formService: FormServiceKind;
  /** The chosen form service's one value: a form ID, an access key, an email address or a URL. */
  readonly formValue: string;
};

/** The form for `settings`, as the dialog opens with it. */
export function toSettingsForm(settings: SiteSettings): SettingsForm {
  const { general, address, social, contact, search, analytics, forms } = settings;
  const service = forms.service;
  return {
    name: general.name,
    description: general.description ?? "",
    language: general.language,
    icon: general.icon,
    url: address.url ?? "",
    profiles: social.profiles.map((profile) => ({ ...profile })),
    shareImage: social.shareImage,
    xHandle: social.xHandle ?? "",
    businessName: contact.businessName ?? "",
    email: contact.email ?? "",
    phone: contact.phone ?? "",
    address: contact.address ?? "",
    openingHours: contact.openingHours.map((hours) => ({ ...hours, days: [...hours.days] })),
    openingHoursNote: contact.openingHoursNote ?? "",
    allowIndexing: search.allowIndexing,
    includeSitemap: search.includeSitemap,
    measurementId: analytics.measurementId ?? "",
    consentBanner: analytics.consentBanner,
    formService: service?.kind ?? "",
    formValue:
      service === undefined
        ? ""
        : service.kind === "formspree"
          ? service.formId
          : service.kind === "web3forms"
            ? service.accessKey
            : service.kind === "formsubmit"
              ? service.email
              : service.kind === "custom"
                ? service.url
                : "",
  };
}

/** `{ [key]: value }` for a non-empty trimmed value, so empty fields stay absent. */
function optional<K extends string>(key: K, value: string): { [P in K]?: string } {
  const trimmed = value.trim();
  return (trimmed === "" ? {} : { [key]: trimmed }) as { [P in K]?: string };
}

function formServiceOf(form: SettingsForm): Record<string, string> | undefined {
  const value = form.formValue.trim();
  switch (form.formService) {
    case "":
      return undefined;
    case "formspree":
      return { kind: "formspree", formId: value };
    case "web3forms":
      return { kind: "web3forms", accessKey: value };
    case "formsubmit":
      return { kind: "formsubmit", email: value };
    case "netlify":
      return { kind: "netlify" };
    case "custom":
      return { kind: "custom", url: value };
  }
}

/**
 * The settings the form describes, unchecked: `previous` supplies what the dialog doesn't edit
 * (publish destinations, allowed external addresses). {@link checkSettings} validates it.
 */
export function fromSettingsForm(form: SettingsForm, previous: SiteSettings): unknown {
  const service = formServiceOf(form);
  const handle = form.xHandle.trim();
  return {
    general: {
      name: form.name.trim(),
      ...optional("description", form.description),
      language: form.language.trim(),
      ...(form.icon === undefined ? {} : { icon: form.icon }),
    },
    address: optional("url", form.url.trim().replace(/\/$/, "")),
    social: {
      profiles: form.profiles.map((profile) => ({
        network: profile.network,
        url: profile.url.trim(),
      })),
      ...(form.shareImage === undefined ? {} : { shareImage: form.shareImage }),
      ...(handle === "" ? {} : { xHandle: handle.startsWith("@") ? handle : `@${handle}` }),
    },
    contact: {
      ...optional("businessName", form.businessName),
      ...optional("email", form.email),
      ...optional("phone", form.phone),
      ...optional("address", form.address),
      openingHours: form.openingHours.map((hours) => ({
        // In the week's order, whatever order they were ticked in.
        days: DAYS.filter((day) => hours.days.includes(day)),
        opens: hours.opens,
        closes: hours.closes,
      })),
      ...optional("openingHoursNote", form.openingHoursNote),
    },
    search: { allowIndexing: form.allowIndexing, includeSitemap: form.includeSitemap },
    analytics: {
      ...optional("measurementId", form.measurementId.toUpperCase()),
      consentBanner: form.consentBanner,
    },
    forms: service === undefined ? {} : { service },
    publish: previous.publish,
    allowedExternalUrls: previous.allowedExternalUrls,
  };
}

/** The friendly message for each field, by its path with list positions as `*`. */
const MESSAGES: Readonly<Record<string, Parameters<typeof t>[0]>> = {
  "general.name": "site.settings.error.name",
  "general.description": "site.settings.error.description",
  "general.language": "site.settings.error.language",
  "address.url": "site.settings.error.webAddress",
  "social.profiles.*.url": "site.settings.error.profileUrl",
  "social.xHandle": "site.settings.error.xHandle",
  "contact.businessName": "site.settings.error.tooLong",
  "contact.email": "site.settings.error.email",
  "contact.phone": "site.settings.error.phone",
  "contact.address": "site.settings.error.tooLong",
  "contact.openingHours.*.days": "site.settings.error.days",
  "contact.openingHours.*.opens": "site.settings.error.time",
  "contact.openingHours.*.closes": "site.settings.error.time",
  "contact.openingHoursNote": "site.settings.error.tooLong",
  "analytics.measurementId": "site.settings.error.measurementId",
  "forms.service.formId": "site.settings.error.formspree",
  "forms.service.accessKey": "site.settings.error.web3forms",
  "forms.service.email": "site.settings.error.email",
  "forms.service.url": "site.settings.error.formUrl",
};

/**
 * The form field a validation issue belongs to, as the dialog names fields: `contact.email`,
 * `social.profiles.0.url`, `contact.openingHours.1.opens`. A form service's value is `forms.value`.
 */
function fieldOf(path: readonly PropertyKey[]): string {
  const parts = path.map(String);
  return parts[0] === "forms" ? "forms.value" : parts.join(".");
}

/** Outcome of checking the form: the valid settings, or a message per field to fix. */
export type SettingsCheck =
  | { readonly ok: true; readonly settings: SiteSettings }
  | { readonly ok: false; readonly errors: Readonly<Record<string, string>> };

/**
 * Checks the form with the model's own schema (X3, F-SET-1), turning its issues into messages a
 * person can act on ("Use an email address such as hello@example.com."), one per field.
 */
export function checkSettings(form: SettingsForm, previous: SiteSettings): SettingsCheck {
  const parsed = siteSettingsSchema.safeParse(fromSettingsForm(form, previous));
  if (parsed.success) {
    return { ok: true, settings: parsed.data };
  }
  const errors: Record<string, string> = {};
  for (const issue of parsed.error.issues) {
    const field = fieldOf(issue.path);
    if (errors[field] !== undefined) continue;
    const pattern = issue.path
      .map((part) => (typeof part === "number" ? "*" : String(part)))
      .join(".");
    errors[field] = t(MESSAGES[pattern] ?? "site.settings.error.invalid");
  }
  return { ok: false, errors };
}

/** Whether two JSON values are equal, whatever order their objects' keys are in. */
function sameJson(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) || Array.isArray(b)) {
    return (
      Array.isArray(a) &&
      Array.isArray(b) &&
      a.length === b.length &&
      a.every((item, index) => sameJson(item, b[index]))
    );
  }
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  const left = a as Record<string, unknown>;
  const right = b as Record<string, unknown>;
  const keys = Object.keys(left);
  return (
    keys.length === Object.keys(right).length &&
    keys.every((key) => Object.hasOwn(right, key) && sameJson(left[key], right[key]))
  );
}

/**
 * Saves Site Settings as one undo step, "Changed Site Settings" (F-SET-1). Nothing happens when
 * nothing changed, even if the dialog built the same settings with their keys in another order.
 */
export function saveSiteSettings(
  session: Pick<EditorSession, "edit"> & {
    readonly history: Pick<EditorSession["history"], "document">;
  },
  settings: SiteSettings,
): boolean {
  const current = session.history.document.getState().settings;
  if (sameJson(current, settings)) {
    return false;
  }
  session.edit("props", t("site.settings.history"), (draft) => {
    draft.settings = settings;
  });
  return true;
}
