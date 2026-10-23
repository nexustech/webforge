import type { BehaviourName } from "./library.js";

/** Every file of `behaviours/`, as its text, by path ("./behaviours/menu.js"). */
const FILES = import.meta.glob("./behaviours/*.js", {
  query: "?raw",
  import: "default",
  eager: true,
});

/**
 * The source of each `webforge.js` behaviour, by name: one plain, readable classic script per file
 * of `behaviours/` (decisions X1, X4), named after the file. Each is a self-contained IIFE, so the
 * pipeline can concatenate the ones a site needs; adding a behaviour is adding its file.
 */
export const BEHAVIOUR_SCRIPTS: Readonly<Record<BehaviourName, string>> = Object.fromEntries(
  Object.entries(FILES).map(([path, script]) => [path.replace(/^.*\/|\.js$/g, ""), script]),
);
