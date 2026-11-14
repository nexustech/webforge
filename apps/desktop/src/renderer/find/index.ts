/**
 * Find and Replace's area (6.2): what other areas use of it. Another area imports only from this
 * file (`pnpm deps`, B2); everything else here is the area's own.
 */

// The text fields an owner writes, read and set: what the assistant drafts a business's words for
// (QS-7, #873).
export { setTextField, type TextFieldRef, textFieldsOf } from "./find-text.js";
