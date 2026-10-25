/**
 * The Site panel's area (pages, 1.8): what other areas use of it. Another area imports only from this file (`pnpm deps`, B2); everything else
 * here is the area's own.
 */
export { addPage, renamePage, setHiddenFromNavigation } from "./page-actions.js";
export { registerSitePanel } from "./SitePanel.js";
