import type { ThemeTokens } from "@webforge/model";
import {
  BACKGROUND_DEFAULTS,
  BACKGROUND_FIELDS,
  type FieldDef,
  OVERLAYS,
  sectionOverlay,
} from "@webforge/site-components";
import { overlayContrastIssue } from "@webforge/themes";

/**
 * The overlay a section's background image starts with when the person first places one (2.26,
 * ST-9): the weakest that keeps the section's text readable over any image in the site's theme,
 * in the section's colours (reversed or not) and its overlay colour, or the strongest when none
 * does. Set in the same step as the image. `undefined` leaves the overlay as it is: for another
 * field, a section that already had an image, an image taken away, or an overlay the person chose
 * (one other than the default). A theme changed later changes nothing: the warning covers that.
 */
export function placedOverlay(
  field: FieldDef,
  values: Readonly<Record<string, unknown>>,
  image: unknown,
  theme: ThemeTokens,
): string | undefined {
  if (field !== BACKGROUND_FIELDS.backgroundImage || sectionOverlay(values) !== null) {
    return undefined;
  }
  const placed = { ...values, backgroundImage: image };
  const chosen = values.overlay !== undefined && values.overlay !== BACKGROUND_DEFAULTS.overlay;
  if (chosen || sectionOverlay(placed) === null) return undefined;
  const readable = (overlay: string) => {
    const drawn = sectionOverlay({ ...placed, overlay });
    return drawn !== null && overlayContrastIssue(theme, drawn) === null;
  };
  return OVERLAYS.find(readable) ?? OVERLAYS[OVERLAYS.length - 1];
}
