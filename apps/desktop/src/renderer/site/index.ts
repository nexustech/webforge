/**
 * The Site panel's area (pages, 1.8): what other areas use of it. Another area imports only from this file (`pnpm deps`, B2); everything else
 * here is the area's own.
 */

// A Blog and its posts (6.10a), for other areas' tests of what reads the Blog's design (#936).
export { insertBlog, insertPost } from "./blog-actions.js";
export {
  addPage,
  addPolicyPage,
  renamePage,
  setDraftPage,
  setHiddenFromNavigation,
} from "./page-actions.js";
export { recipeName } from "./recipe-name.js";
export { registerSitePanel } from "./register-site-panel.js";
