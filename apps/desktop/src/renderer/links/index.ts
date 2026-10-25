/**
 * The links area (F-ED-18): what other areas use of it. Another area imports only from this file (`pnpm deps`, B2); everything else
 * here is the area's own.
 */

export { LinkDialog } from "./LinkDialog.js";
export { linkFieldRenderer } from "./LinkField.js";
export { applyAnchor, type LinkFieldChange } from "./link-change.js";
export { linkTargets, type PageTarget } from "./link-targets.js";
