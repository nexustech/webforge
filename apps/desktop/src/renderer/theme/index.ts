/**
 * The Theme panel's area (2.3): what other areas use of it. Another area imports only from this file
 * (`pnpm deps`, B2); everything else here is the area's own.
 */
export { THEME_PANEL_ID } from "./register-theme-panel.js";
// Reading a picture's colours, for the quick start's *From my logo* (3.11b) as Theme Studio does.
export { readPixels } from "./studio/image-pixels.js";
export { ROLE_NAMES } from "./theme-edits.js";
