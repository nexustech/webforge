import { BUSINESS_TYPES } from "@webforge/model";

/**
 * The business types the New Site dialog's chips filter by (UX-29): `t("template.category.<id>")`.
 * The model's {@link BUSINESS_TYPES}, which Site Settings keeps for the structured data (3.15).
 */
export const TEMPLATE_CATEGORIES = BUSINESS_TYPES;

/** One of {@link TEMPLATE_CATEGORIES}. */
export type TemplateCategory = (typeof TEMPLATE_CATEGORIES)[number];
