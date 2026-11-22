import { BUSINESS_KINDS, BUSINESS_TYPES } from "@webforge/model";
import { TEMPLATE_IDS } from "@webforge/templates";

// Main's strings (#1317): main reads only its own catalogue, `@webforge/i18n/main`, which `pnpm
// main-strings` makes from the keys main's and the shared code's files name. The keys main builds
// at run time are made here and listed below, so the catalogue holds every one.

/** A business type's name, as a brief offers it: `template.category.<type>`. */
export const categoryKey = (type: string) => `template.category.${type}`;

/** A kind of business's name: `site.settings.businessKind.<kind>`. */
export const businessKindKey = (kind: string) => `site.settings.businessKind.${kind}`;

/** A template's name: `template.<id>.name`. */
export const templateNameKey = (id: string) => `template.${id}.name`;

/** Every key main builds at run time: what `site-brief.ts` names, from the model's lists. */
export const MAIN_RUNTIME_KEYS: readonly string[] = [
  ...BUSINESS_TYPES.map(categoryKey),
  ...BUSINESS_TYPES.flatMap((type) => BUSINESS_KINDS[type].map(businessKindKey)),
  ...TEMPLATE_IDS.map(templateNameKey),
];
