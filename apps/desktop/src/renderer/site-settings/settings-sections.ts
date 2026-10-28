import type { FormField, FormSpec } from "@webforge/editor-ui";
import { t } from "@webforge/i18n";
import {
  BUSINESS_KINDS,
  BUSINESS_NAME_MAX,
  BUSINESS_TYPES,
  type BusinessKind,
  CONSENT_MESSAGE_MAX,
  type ImageMeta,
  LANGUAGE_TAG_MAX,
  MEASUREMENT_ID_MAX,
  OPENING_HOURS_NOTE_MAX,
  POSTAL_ADDRESS_MAX,
  PRICE_RANGE_MAX,
  SITE_DESCRIPTION_MAX,
  SITE_NAME_MAX,
  type SiteSettings,
  SOCIAL_NETWORKS,
  X_HANDLE_MAX,
} from "@webforge/model";

import {
  DAYS,
  FORM_SERVICES,
  fromSettingsForm,
  SECTIONS,
  type Section,
  type SettingsForm,
  settingsSchema,
} from "./settings-form.js";

/** Room for a verification code pasted with its whole `<meta>` tag (3.15, SEO-8). */
const VERIFICATION_PASTE_MAX = 300;

/** One of Site Settings' sections (F-SET-1): its fields, for the values the dialog holds. */
type SettingsSection = {
  readonly id: Section;
  readonly fields: (values: SettingsForm) => readonly FormField[];
};

/** What the sections' image choices need: Media's images, and where each one's thumbnail is. */
type SettingsMedia = {
  readonly images: readonly ImageMeta[];
  readonly imageUrl: (image: ImageMeta) => string;
};

/** A choice of one of Media's images, or none: its hint, or how to add some while there are none. */
function imageField(
  name: "icon" | "shareImage",
  label: string,
  hint: string,
  { images, imageUrl }: SettingsMedia,
): FormField {
  return {
    kind: "imageChoice",
    name,
    label,
    help: images.length === 0 ? t("site.settings.noImages") : hint,
    noneLabel: t("site.settings.noImage"),
    options: images.map((image) => ({
      value: image.id,
      label: image.fileName,
      thumbnail: imageUrl(image),
    })),
  };
}

/**
 * The schema.org type within the chosen kind of business (3.15, SEO-1): offered when the kind has
 * more than one, its first meaning "none more precise".
 */
function businessKindField(typed: string): FormField[] {
  const type = BUSINESS_TYPES.find((each) => each === typed);
  const kinds: readonly BusinessKind[] = type === undefined ? [] : BUSINESS_KINDS[type];
  if (kinds.length < 2) return [];
  return [
    {
      kind: "select",
      name: "businessKind",
      path: "general.businessKind",
      label: t("site.settings.businessKind"),
      width: "md",
      options: kinds.map((kind, index) => ({
        label: t(`site.settings.businessKind.${kind}`),
        value: index === 0 ? "" : kind,
      })),
    },
  ];
}

/** Site Settings' sections, in the dialog's order, each a group of the form's fields. */
function sections(media: SettingsMedia): readonly SettingsSection[] {
  return [
    {
      id: "general",
      fields: () => [
        { kind: "text", name: "name", label: t("site.settings.name"), maxLength: SITE_NAME_MAX },
        {
          kind: "text",
          name: "description",
          label: t("site.settings.siteDescription"),
          help: t("site.settings.siteDescriptionHint"),
          multiline: true,
          maxLength: SITE_DESCRIPTION_MAX,
        },
        {
          kind: "text",
          name: "language",
          label: t("site.settings.language"),
          help: t("site.settings.languageHint"),
          maxLength: LANGUAGE_TAG_MAX,
          width: "sm",
        },
        imageField("icon", t("site.settings.icon"), t("site.settings.iconHint"), media),
        {
          kind: "toggle",
          name: "backToTop",
          label: t("site.settings.backToTop"),
          // The canvas doesn't show it: only the published site has it.
          help: t("site.settings.backToTopHint"),
        },
        // For AI tools, not search engines, so not with them (3.15, SEO-12): off unless turned on.
        {
          kind: "toggle",
          name: "readableByAi",
          path: "search.readableByAi",
          label: t("site.settings.readableByAi"),
          help: t("site.settings.readableByAiHint"),
        },
      ],
    },
    {
      id: "address",
      fields: () => [
        {
          kind: "text",
          name: "url",
          path: "address.url",
          label: t("site.settings.webAddress"),
          help: t("site.settings.webAddressHint"),
          inputType: "url",
          placeholder: t("site.settings.webAddressPlaceholder"),
        },
      ],
    },
    {
      id: "social",
      fields: () => [
        {
          kind: "list",
          name: "profiles",
          path: "social.profiles",
          label: t("site.settings.profiles"),
          // The logos are trademarks (PH2-4): they may only link to the site's own pages.
          help: t("site.settings.profilesHint"),
          itemLabel: t("site.settings.profileUrl"),
          addLabel: t("site.settings.addProfile"),
          removeLabel: t("site.settings.removeProfile"),
          itemFields: [
            {
              kind: "select",
              name: "network",
              label: t("site.settings.network"),
              options: SOCIAL_NETWORKS.map((network) => ({
                label: t(`site.settings.network.${network}`),
                value: network,
              })),
            },
            {
              kind: "text",
              name: "url",
              label: t("site.settings.profileUrl"),
              inputType: "url",
              placeholder: "https://",
            },
          ],
          newItem: () => ({ network: "facebook", url: "" }),
        },
        imageField(
          "shareImage",
          t("site.settings.shareImage"),
          t("site.settings.shareImageHint"),
          media,
        ),
        {
          kind: "text",
          name: "xHandle",
          path: "social.xHandle",
          label: t("site.settings.xHandle"),
          placeholder: "@",
          maxLength: X_HANDLE_MAX,
          width: "md",
        },
      ],
    },
    {
      id: "contact",
      fields: () => [
        {
          kind: "text",
          name: "businessName",
          label: t("site.settings.businessName"),
          maxLength: BUSINESS_NAME_MAX,
        },
        { kind: "text", name: "email", label: t("site.settings.email"), inputType: "email" },
        { kind: "text", name: "phone", label: t("site.settings.phone"), inputType: "tel" },
        {
          kind: "text",
          name: "address",
          label: t("site.settings.address"),
          multiline: true,
          maxLength: POSTAL_ADDRESS_MAX,
        },
        {
          kind: "list",
          name: "openingHours",
          label: t("site.settings.openingHours"),
          itemLabel: t("site.settings.openingHours"),
          addLabel: t("site.settings.addHours"),
          removeLabel: t("site.settings.removeHours"),
          itemFields: [
            {
              kind: "multiChoice",
              name: "days",
              label: t("site.settings.days"),
              options: DAYS.map((day) => ({ label: t(`site.settings.day.${day}`), value: day })),
            },
            { kind: "time", name: "opens", label: t("site.settings.opens") },
            { kind: "time", name: "closes", label: t("site.settings.closes") },
          ],
          newItem: () => ({ days: [], opens: "09:00", closes: "17:00" }),
        },
        {
          kind: "text",
          name: "openingHoursNote",
          label: t("site.settings.openingHoursNote"),
          help: t("site.settings.openingHoursNoteHint"),
          maxLength: OPENING_HOURS_NOTE_MAX,
        },
        // For search engines' business details (3.15, SEO-1).
        {
          kind: "text",
          name: "priceRange",
          label: t("site.settings.priceRange"),
          help: t("site.settings.priceRangeHint"),
          maxLength: PRICE_RANGE_MAX,
          width: "sm",
        },
        {
          kind: "text",
          name: "latitude",
          path: "contact.geo.latitude",
          label: t("site.settings.latitude"),
          help: t("site.settings.geoHint"),
          maxLength: 20,
          width: "sm",
        },
        {
          kind: "text",
          name: "longitude",
          path: "contact.geo.longitude",
          label: t("site.settings.longitude"),
          maxLength: 20,
          width: "sm",
        },
      ],
    },
    {
      id: "search",
      fields: (values) => [
        // What kind of business it is, which its structured data says (3.15, SEO-1).
        {
          kind: "select",
          name: "businessType",
          path: "general.businessType",
          label: t("site.settings.businessType"),
          help: t("site.settings.businessTypeHint"),
          width: "md",
          options: [
            { label: t("site.settings.businessType.none"), value: "" },
            ...BUSINESS_TYPES.map((type) => ({
              label: t(`template.category.${type}`),
              value: type,
            })),
          ],
        },
        ...businessKindField(values.businessType),
        { kind: "toggle", name: "allowIndexing", label: t("site.settings.allowIndexing") },
        { kind: "toggle", name: "includeSitemap", label: t("site.settings.includeSitemap") },
        // Proof the site is the owner's, for each console (3.15, SEO-8): no account here.
        {
          kind: "text",
          name: "googleVerification",
          path: "search.verification.google",
          label: t("site.settings.googleVerification"),
          help: t("site.settings.googleVerificationHint"),
          maxLength: VERIFICATION_PASTE_MAX,
        },
        {
          kind: "text",
          name: "bingVerification",
          path: "search.verification.bing",
          label: t("site.settings.bingVerification"),
          help: t("site.settings.bingVerificationHint"),
          maxLength: VERIFICATION_PASTE_MAX,
        },
      ],
    },
    {
      id: "analytics",
      fields: () => [
        {
          kind: "text",
          name: "measurementId",
          label: t("site.settings.measurementId"),
          help: t("site.settings.measurementIdHint"),
          maxLength: MEASUREMENT_ID_MAX,
        },
        { kind: "toggle", name: "consentBanner", label: t("site.settings.consentBanner") },
        {
          kind: "text",
          name: "consentMessage",
          label: t("site.settings.consentMessage"),
          help: t("site.settings.consentMessageHint"),
          maxLength: CONSENT_MESSAGE_MAX,
        },
      ],
    },
    {
      id: "forms",
      fields: ({ formService }) => [
        {
          kind: "select",
          name: "formService",
          // The service's value is what is checked.
          path: "forms.kind",
          label: t("site.settings.formService"),
          help: t("site.settings.formServiceHint"),
          width: "md",
          options: FORM_SERVICES.map((service) => ({
            label: t(`site.settings.formService.${service === "" ? "none" : service}`),
            value: service,
          })),
        },
        // A service's one value: none for no service, nor for Netlify, whose publisher sets it up.
        ...(formService === "" || formService === "netlify"
          ? []
          : [
              {
                kind: "text" as const,
                name: "formValue",
                path: "forms.service",
                label: t(`site.settings.formValue.${formService}`),
                ...(formService === "custom"
                  ? { help: t("site.settings.formValue.customHint") }
                  : {}),
                inputType:
                  formService === "formsubmit"
                    ? ("email" as const)
                    : formService === "custom"
                      ? ("url" as const)
                      : ("text" as const),
              },
            ]),
      ],
    },
  ];
}

/**
 * Site Settings as a form (F-SET-1, 2.21): one tab per section, checked on Save by the model's
 * schema ({@link settingsSchema}). `previous` gives what the dialog doesn't edit (publish
 * destinations).
 */
export function siteSettingsSpec(
  previous: SiteSettings,
  media: SettingsMedia,
): FormSpec<SettingsForm, SiteSettings> {
  const all = sections(media);
  return {
    groups: SECTIONS.map((id) => ({ id, label: t(`site.settings.section.${id}`) })),
    fields: (values) =>
      all.flatMap((section) =>
        section.fields(values).map((field) => ({
          ...field,
          group: section.id,
          // A field's path in the settings: its section, then its name, unless it says.
          path: field.path ?? `${section.id}.${field.name}`,
        })),
      ),
    schema: settingsSchema,
    toModel: (values) => fromSettingsForm(values, previous),
    // A new service's value is another kind of value: it starts empty.
    adjust: (next, before) =>
      next.formService === before.formService ? next : { ...next, formValue: "" },
  };
}
