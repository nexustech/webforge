/**
 * The assistant's area (6.9c, 6.9d): what other areas use of it. Another area imports only from
 * this file (`pnpm deps`, B2); everything else here is the area's own.
 */

// The writing help's drafts (#873): Site Check's description and alt text, the quick start's copy.
export { asAssistantStep, assistantLabel } from "./assistant-step.js";
export { DraftDialog } from "./DraftDialog.js";
export { type DraftApi, type DraftState, useAssistantStatus, useDraft } from "./use-draft.js";
