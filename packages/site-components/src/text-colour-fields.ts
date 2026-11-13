/**
 * The fields that colour an element's text, which the contrast checks measure (#670): Site Check's
 * rule, and the Edit panel's warning on a gradient's two ends (CT-13). On a graphic component (an
 * Icon, Social links), its drawing's. A gradient's, a background's or a border's colour isn't text.
 */
export const TEXT_COLOUR_FIELDS: ReadonlySet<string> = new Set([
  "color",
  "lookColor",
  "lookTitleColor",
]);
