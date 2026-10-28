/**
 * The clipboard's area (1.25, 1.37, 2.27): what other areas use of it. Another area imports only
 * from this file (`pnpm deps`, B2); everything else here is the area's own.
 */

export {
  APPEARANCE_GROUP_ID,
  applyLook,
  applyLookToAll,
  LOOK_COMMANDS,
  lookChange,
  lookChangeIn,
  lookFieldsOf,
} from "./apply-look.js";
