/**
 * The Add panel's area (1.13): what other areas use of it. Another area imports only from this file (`pnpm deps`, B2); everything else
 * here is the area's own.
 */
export { type AddItem, type AddTarget, addTarget, insertAt } from "./add-items.js";
export { createKindPreviews, createSectionPreviews } from "./section-preview.js";
