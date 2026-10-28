import { BUSINESS_TYPES } from "@webforge/model";

/**
 * The business types the New Site dialog's chips filter by (UX-29): `t("template.category.<id>")`.
 * Site Settings' own (SEO-9), so a template's is a site's.
 */
export const TEMPLATE_CATEGORIES = BUSINESS_TYPES;

/** One of {@link TEMPLATE_CATEGORIES}. */
export type TemplateCategory = (typeof TEMPLATE_CATEGORIES)[number];
