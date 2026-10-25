import { type FormSchema, sameValue } from "@webforge/editor-ui";
import { t } from "@webforge/i18n";
import {
  DAYS,
  type Day,
  type MediaId,
  type SiteSettings,
  type SOCIAL_NETWORKS,
  siteSettingsSchema,
} from "@webforge/model";
import type { EditorSession } from "../editor/editor-session.js";
import "../shell/form-messages.js";

/** The days of the week, in the order the dialog shows them: the model's, Monday first. */
export { DAYS };

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
type FormServiceKind = (typeof FORM_SERVICES)[number];

/**
 * What the Site Settings dialog edits: every value as the user types it (empty strings for empty
 * fields), so the form can hold invalid input until Save checks it. Rows of profiles and opening
 * hours have ids while the dialog is open, which saving leaves out.
 */
export type SettingsForm = {
  readonly name: string;
  readonly description: string;
  readonly language: string;
  readonly icon: MediaId | undefined;
  /** A back-to-top button on every page that doesn't hide it (F-CM-9). */
  readonly backToTop: boolean;
  readonly url: string;
  readonly profiles: readonly {
    readonly id: string;
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
    readonly id: string;
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
    backToTop: general.backToTop === true,
    url: address.url ?? "",
    profiles: social.profiles.map((profile, index) => ({ id: `profile-${index}`, ...profile })),
    shareImage: social.shareImage,
    xHandle: social.xHandle ?? "",
    businessName: contact.businessName ?? "",
    email: contact.email ?? "",
    phone: contact.phone ?? "",
    address: contact.address ?? "",
    openingHours: contact.openingHours.map((hours, index) => ({
      id: `hours-${index}`,
      ...hours,
      days: [...hours.days],
    })),
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
 * (publish destinations, allowed external addresses). {@link settingsSchema} checks it.
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
      // Absent when off, as in files from before it.
      ...(form.backToTop ? { backToTop: true } : {}),
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

/**
 * The settings' own wording for problems the editor's general words can't describe: a value that
 * isn't in the form it should be (a language code, a web address, a phone number, an ID), by its
 * path with list positions as `*` (2.21, decision 4). Too long or empty says so in general words.
 */
const MESSAGES: Readonly<Record<string, Parameters<typeof t>[0]>> = {
  "general.language": "site.settings.error.language",
  "address.url": "site.settings.error.webAddress",
  "social.profiles.*.url": "site.settings.error.profileUrl",
  "social.xHandle": "site.settings.error.xHandle",
  "contact.email": "site.settings.error.email",
  "contact.phone": "site.settings.error.phone",
  "contact.openingHours.*.days": "site.settings.error.days",
  "contact.openingHours.*.opens": "site.settings.error.time",
  "contact.openingHours.*.closes": "site.settings.error.time",
  "analytics.measurementId": "site.settings.error.measurementId",
  "forms.service.formId": "site.settings.error.formspree",
  "forms.service.accessKey": "site.settings.error.web3forms",
  "forms.service.email": "site.settings.error.email",
  "forms.service.url": "site.settings.error.formUrl",
};

/** Whether `issue` is text too long or missing, which general words say best. */
const sizeProblem = (issue: { readonly code: string; readonly origin?: string }) =>
  (issue.code === "too_big" || issue.code === "too_small") && issue.origin === "string";

/**
 * Site Settings' schema for the form (X3, F-SET-1, 2.21): the model's own, with the settings' own
 * wording for a value in the wrong form ({@link MESSAGES}) and the editor's general words for the
 * rest. Its issues are at the model's paths, which the form's fields name.
 */
export const settingsSchema: FormSchema<SiteSettings> = {
  "~standard": {
    validate: (value) => {
      const parsed = siteSettingsSchema.safeParse(value);
      if (parsed.success) return { value: parsed.data };
      return {
        issues: parsed.error.issues.map((issue) => {
          const pattern = issue.path
            .map((part) => (typeof part === "number" ? "*" : String(part)))
            .join(".");
          const own = MESSAGES[pattern];
          return {
            path: issue.path,
            message: own === undefined || sizeProblem(issue) ? issue.message : t(own),
          };
        }),
      };
    },
  },
};

/**
 * Site Settings' sections, in the dialog's order (F-SET-1); each is a group of the settings, and
 * each field's first path part names its section.
 */
export const SECTIONS = [
  "general",
  "address",
  "social",
  "contact",
  "search",
  "analytics",
  "forms",
] as const;
/** One of {@link SECTIONS}. */
export type Section = (typeof SECTIONS)[number];

/**
 * The undo label for a change from `before` to `after`: the sections it changed, as the dialog
 * names them ("Changed Site Settings: Contact & hours"), or the plain label for a change outside
 * them.
 */
function savedLabel(before: SiteSettings, after: SiteSettings): string {
  const sections = SECTIONS.filter((section) => !sameValue(before[section], after[section]));
  const earlier: Readonly<Record<string, unknown>> = before;
  const outside = Object.entries(after).some(
    ([key, value]) =>
      !SECTIONS.some((section) => section === key) && !sameValue(earlier[key], value),
  );
  return sections.length === 0 || outside
    ? t("site.settings.history")
    : t("site.settings.historySections", {
        sections: sections.map((section) => t(`site.settings.section.${section}`)).join(", "),
      });
}

/**
 * Saves Site Settings as one undo step, named for the sections it changed (F-SET-1). Nothing
 * happens when nothing changed, even if the dialog built the same settings with their keys in
 * another order.
 */
export function saveSiteSettings(
  session: Pick<EditorSession, "edit"> & {
    readonly history: Pick<EditorSession["history"], "document">;
  },
  settings: SiteSettings,
): boolean {
  const current = session.history.document.getState().settings;
  if (sameValue(current, settings)) {
    return false;
  }
  session.edit("props", savedLabel(current, settings), (draft) => {
    draft.settings = settings;
  });
  return true;
}
