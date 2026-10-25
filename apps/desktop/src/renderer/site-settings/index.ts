/**
 * The site-settings area: what other areas use of it. Another area imports only from this file
 * (`pnpm deps`, B2); everything else here is the area's own.
 */

export {
  bindingLabel,
  boundFieldOf,
  isBindingField,
  withBinding,
  withBindingChoice,
} from "./binding-fields.js";
