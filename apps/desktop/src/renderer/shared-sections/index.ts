/**
 * The shared sections' area (F-ED-23): what other areas use of it. Another area imports only from this file (`pnpm deps`, B2); everything else
 * here is the area's own.
 */
export {
  type CopySelection,
  copySelection,
  saveAsSharedSection,
  updateSectionField,
} from "./shared-sections.js";
