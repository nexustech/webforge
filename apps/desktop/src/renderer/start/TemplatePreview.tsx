import { DEFAULT_THEME } from "@webforge/model";
import { oklchCss, THEME_PRESETS } from "@webforge/themes";
import type { TemplateSummary } from "../../shared/ipc/templates.js";

/**
 * A template's picture: its thumbnail (2.14b), its home page at desktop width; or, for one without,
 * its theme's colours, so cards in different themes still look different.
 */
export function TemplatePreview({ template }: { readonly template: TemplateSummary }) {
  if (template.thumbnail !== null) {
    return (
      <img
        src={template.thumbnail}
        alt=""
        className="size-full object-cover object-top"
        draggable={false}
      />
    );
  }
  const colors = (THEME_PRESETS.find((preset) => preset.preset === template.theme) ?? DEFAULT_THEME)
    .colors;
  return (
    <span
      className="flex size-full flex-col justify-end gap-1 p-3"
      style={{ backgroundColor: oklchCss(colors["base-100"]) }}
      aria-hidden
    >
      <span
        className="h-2 w-1/2 rounded-full"
        style={{ backgroundColor: oklchCss(colors["base-content"]) }}
      />
      <span
        className="h-2 w-1/3 rounded-full"
        style={{ backgroundColor: oklchCss(colors.primary) }}
      />
    </span>
  );
}
