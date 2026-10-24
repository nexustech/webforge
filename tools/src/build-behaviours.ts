// Behaviours module build (R7): writes `packages/site-components/src/behaviours/index.ts`, the
// text of each `webforge.js` behaviour in that folder (`menu.js`), by name. The package then loads
// without Vite's `import.meta.glob`, in plain Node too. A test in site-components checks that the
// module matches the files.
//
// Usage, after adding or changing a behaviour:
//   pnpm behaviours
//
// This file has no relative imports so Node can run it directly with type stripping.

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** The folder of the behaviours, from the repository root. */
export const BEHAVIOURS_FOLDER = "packages/site-components/src/behaviours";

/**
 * The module that holds `files` (each behaviour's text, by name), by name order, and their names
 * as a type: a component that names a behaviour without a file is then a type error.
 */
export function behavioursModule(files: Readonly<Record<string, string>>): string {
  const sorted = Object.entries(files).sort(([a], [b]) => a.localeCompare(b));
  const names = sorted.map(([name]) => JSON.stringify(name)).join(" | ") || "never";
  const entries = sorted.map(
    ([name, text]) => `  ${JSON.stringify(name)}: ${JSON.stringify(text)},`,
  );
  return [
    "// Generated from this folder's .js files by `pnpm behaviours` (tools/src/build-behaviours.ts):",
    "// don't edit it by hand. A test checks that it matches them.",
    "",
    "/** The name of a `webforge.js` behaviour: its file's name without `.js`. */",
    `export type BehaviourName = ${names};`,
    "",
    "/** The text of each `webforge.js` behaviour, by name. */",
    "export const BEHAVIOUR_FILES: Readonly<Record<BehaviourName, string>> = {",
    ...entries,
    "};",
    "",
  ].join("\n");
}

/** Each behaviour file of `folder` (`menu.js`), as its text by name (`menu`). */
export function readBehaviours(folder: string): Record<string, string> {
  return Object.fromEntries(
    readdirSync(folder)
      .filter((file) => file.endsWith(".js"))
      .map((file) => [file.slice(0, -".js".length), readFileSync(join(folder, file), "utf8")]),
  );
}

if (import.meta.main) {
  writeFileSync(
    join(BEHAVIOURS_FOLDER, "index.ts"),
    behavioursModule(readBehaviours(BEHAVIOURS_FOLDER)),
  );
}
