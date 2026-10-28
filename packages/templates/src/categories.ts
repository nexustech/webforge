/** The business types the New Site dialog's chips filter by (UX-29): `t("template.category.<id>")`. */
export const TEMPLATE_CATEGORIES = [
  "food",
  "beauty",
  "trades",
  "services",
  "creative",
  "shop",
  "personal",
] as const;

/** One of {@link TEMPLATE_CATEGORIES}. */
export type TemplateCategory = (typeof TEMPLATE_CATEGORIES)[number];
