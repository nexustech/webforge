/**
 * The Layers area (1.31, ADR 0011): what other areas use of it. Another area imports only from this
 * file (`pnpm deps`, B2); everything else here is the area's own.
 */
export { deleteSelected, duplicateSelected, moveSelected } from "./bulk-layers.js";
