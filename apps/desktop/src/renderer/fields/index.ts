/**
 * The fields area (2.20, B5): the Edit panel's renderers the app draws itself, one folder per kind
 * (`<kind>/`), and how each kind of field is edited (`FIELD_KINDS`). Another area imports only from
 * this file (`pnpm deps`, B2); everything else here is the area's own.
 */

export { shownRatio, TEXT_PX } from "./color/ColourField.js";
export { fieldRenderers, themeFieldRenderers } from "./field-renderers.js";
