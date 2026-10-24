import { BEHAVIOUR_FILES } from "./behaviours/index.js";
import type { BehaviourName } from "./schema.js";

/**
 * The source of each `webforge.js` behaviour, by name: one plain, readable classic script per file
 * of `behaviours/` (decisions X1, X4), named after the file. Each is a self-contained IIFE, so the
 * pipeline can concatenate the ones a site needs. Adding a behaviour is adding its file and running
 * `pnpm behaviours`, which writes `behaviours/index.ts` (R7): plain strings, so the package loads
 * without Vite, in Node too.
 */
export const BEHAVIOUR_SCRIPTS: Readonly<Record<BehaviourName, string>> = BEHAVIOUR_FILES;
