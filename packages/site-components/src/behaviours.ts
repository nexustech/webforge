import menuScript from "./behaviours/menu.js?raw";
import type { BehaviourName } from "./library.js";

/**
 * The source of each `webforge.js` behaviour: plain, readable classic scripts (decisions X1, X4).
 * Each one is a self-contained IIFE, so the pipeline can concatenate the ones a site needs.
 */
export const BEHAVIOUR_SCRIPTS: Readonly<Record<BehaviourName, string>> = {
  menu: menuScript,
};
