import { isMessageKey, t } from "@webforge/i18n";
import type { TemplateId } from "@webforge/templates";

// What New Site and the quick start show of templates and theme presets (2.14a, 4.8b).

/** A template's name, from its id. */
export const templateName = (id: TemplateId): string => t(`template.${id}.name`);

/** A theme preset's name; the preset's own name for one the catalogue hasn't named yet. */
export function presetLabel(preset: string): string {
  const key = `theme.preset.${preset}`;
  return isMessageKey(key) ? t(key) : preset;
}

/** The grid New Site and the quick start lay their starting points out in. */
export const TEMPLATE_GRID = "grid grid-cols-[repeat(auto-fill,minmax(13rem,1fr))] gap-3";
