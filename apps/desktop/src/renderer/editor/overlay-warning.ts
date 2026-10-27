import { t } from "@webforge/i18n";
import type { ThemeTokens } from "@webforge/model";
import {
  BACKGROUND_FIELDS,
  type ComponentDef,
  type FieldDef,
  sectionOverlay,
} from "@webforge/site-components";
import { overlayContrastIssue } from "@webforge/themes";

/**
 * The warning a section's overlay field shows when its text can be hard to read over the
 * background image (2.26, ST-5): the contrast over the darkest or lightest image below WCAG AA, in
 * the section's own colours. Reported, never blocking, like the theme's contrast warnings. Nothing
 * for any other field, or a section without a background image.
 */
export function overlayWarning(
  field: FieldDef,
  values: Readonly<Record<string, unknown>>,
  theme: ThemeTokens,
  component?: Pick<ComponentDef, "sectionText">,
): string | undefined {
  if (field !== BACKGROUND_FIELDS.overlay) return undefined;
  // In the colour the section's text has: its own, or its layout's (#544).
  const overlay = sectionOverlay(values, component?.sectionText?.(values));
  const issue = overlay === null ? null : overlayContrastIssue(theme, overlay);
  return issue === null
    ? undefined
    : t("field.overlay.lowContrast", { ratio: issue.ratio, required: issue.required });
}
