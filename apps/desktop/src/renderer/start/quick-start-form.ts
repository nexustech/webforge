import type { FormField, FormSchema, FormSpec, ListItem } from "@webforge/editor-ui";
import { t } from "@webforge/i18n";
import type { Day } from "@webforge/model";
import { type BusinessDetails, businessDetailsSchema } from "@webforge/templates";
import { contactDetailFields } from "../site-settings/index.js";
import "../shell/form-messages.js";
import type { QuickStartAnswers } from "./quick-start.js";

/** The last step's details as typed (QS-6, SEO-9): text as it is, opening hours with ids. */
export type DetailsValues = {
  readonly email: string;
  readonly phone: string;
  readonly address: string;
  readonly openingHours: readonly ListItem[];
  readonly webAddress: string;
};

/** The details before any is typed. */
export const EMPTY_DETAILS: DetailsValues = {
  email: "",
  phone: "",
  address: "",
  openingHours: [],
  webAddress: "",
};

/** The answers' details from the form's values: opening hours without the form's ids. */
export function detailsAnswers(
  values: DetailsValues,
): Pick<QuickStartAnswers, "email" | "phone" | "address" | "openingHours" | "webAddress"> {
  return {
    email: values.email,
    phone: values.phone,
    address: values.address,
    openingHours: values.openingHours.map((hours) => ({
      days: (Array.isArray(hours.days) ? hours.days : []) as Day[],
      opens: typeof hours.opens === "string" ? hours.opens : "",
      closes: typeof hours.closes === "string" ? hours.closes : "",
    })),
    webAddress: values.webAddress,
  };
}

/** The values as the schema takes them: trimmed, the empty ones left out (QS-6). */
function toModel(values: DetailsValues): BusinessDetails {
  const { openingHours, ...text } = detailsAnswers(values);
  return {
    ...Object.fromEntries(
      Object.entries(text).flatMap(([key, value]) => {
        const trimmed = value.trim();
        return trimmed === "" ? [] : [[key, trimmed]];
      }),
    ),
    ...(openingHours.length === 0 ? {} : { openingHours: [...openingHours] }),
  };
}

/**
 * Site Settings' own wording for a value in the wrong form, by its path with list positions as `*`
 * (as Site Settings words them, 2.21): the quick start asks the same things.
 */
const MESSAGES: Readonly<Record<string, Parameters<typeof t>[0]>> = {
  email: "site.settings.error.email",
  phone: "site.settings.error.phone",
  "openingHours.*.days": "site.settings.error.days",
  "openingHours.*.opens": "site.settings.error.time",
  "openingHours.*.closes": "site.settings.error.time",
  webAddress: "site.settings.error.webAddress",
};

/** The details' schema: what New Site takes, with Site Settings' wording and the general words. */
const detailsSchema: FormSchema<BusinessDetails> = {
  "~standard": {
    validate: (value) => {
      const parsed = businessDetailsSchema.safeParse(value);
      if (parsed.success) return { value: parsed.data };
      return {
        issues: parsed.error.issues.map((issue) => {
          const own =
            MESSAGES[
              issue.path.map((part) => (typeof part === "number" ? "*" : String(part))).join(".")
            ];
          const size =
            (issue.code === "too_big" || issue.code === "too_small") && issue.origin === "string";
          return { path: issue.path, message: own === undefined || size ? issue.message : t(own) };
        }),
      };
    },
  },
};

/**
 * The last step's form (QS-6, SEO-9): the contact details as Site Settings asks them, then the web
 * address, each optional; checked once the person tries to create the site, as Site Settings is.
 */
export function detailsSpec(): FormSpec<DetailsValues, BusinessDetails> {
  const fields: readonly FormField[] = [
    ...contactDetailFields(),
    {
      kind: "text",
      name: "webAddress",
      label: t("site.settings.webAddress"),
      help: t("site.settings.webAddressHint"),
      inputType: "url",
      placeholder: t("site.settings.webAddressPlaceholder"),
    },
  ];
  return { fields, schema: detailsSchema, toModel };
}
