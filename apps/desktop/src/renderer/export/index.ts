/**
 * The export's area (3.1, 3.3): what other areas use of it. Another area imports only from this
 * file (`pnpm deps`, B2); everything else here is the area's own.
 */

export { siteContentFor } from "./export-request.js";
