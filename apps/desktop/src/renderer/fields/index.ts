/**
 * The fields area (2.20, B5): the Edit panel's renderers the app draws itself, one folder per kind
 * (`<kind>/`), and how each kind of field is edited (`FIELD_KINDS`). Another area imports only from
 * this file (`pnpm deps`, B2); everything else here is the area's own.
 */

export { TEXT_PX } from "@webforge/themes";
export { classesFieldRenderer } from "./classes/ClassesField.js";
export { useClassCatalogue } from "./classes/class-catalogue.js";
export type { ClassCatalogue } from "./classes/class-match.js";
export { codeField } from "./code/field.js";
export { ColourField, colourRefName, shownRatio } from "./color/ColourField.js";
export { colourField } from "./color/field.js";
export { hexOf } from "./color/hex.js";
export { fieldRenderers, themeFieldRenderers } from "./field-renderers.js";
export { addFontPreviews, previewFamily } from "./font/font-previews.js";
export { ThemeColorField } from "./theme-color/ThemeColorField.js";
