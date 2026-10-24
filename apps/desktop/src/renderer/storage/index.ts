/**
 * The storage area (the open site's session): what other areas use of it. Another area imports only from this file (`pnpm deps`, B2); everything else
 * here is the area's own.
 */
export { siteSession } from "./site-session.js";
