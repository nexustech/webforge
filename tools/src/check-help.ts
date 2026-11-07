// Help pages' check (5.4b, HP-5): the pages in docs/help stay readable by the app and in step
// with it.
//
// Usage (see the root "help-check" script, part of `pnpm check`):
//   node tools/src/check-help.ts
//
// Run from the repository root. It reads `docs/help/*.md` (not its README), the site components'
// catalogue (`packages/site-components/src/catalogue-data.json`) and the app's name (`app.name` in
// `packages/i18n/src/en`), and fails when `checkHelpPages` (`@webforge/help`) finds anything:
// front matter that doesn't parse, an id that's repeated or isn't its file's name, a link or anchor
// between pages that doesn't resolve, a component type on no page or on two, the app's name spelled
// out, raw HTML or a picture.
//
// This file has no relative imports so Node can run it directly with type stripping.

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { checkHelpPages } from "@webforge/help/pages";

/** Where the pages, the catalogue and the strings are, from the repository root. */
export const HELP_PATHS = {
  pages: "docs/help",
  catalogue: "packages/site-components/src/catalogue-data.json",
  strings: "packages/i18n/src/en",
} as const;

/** The app's name, as `app.name` in the string catalogue under `folder` has it. */
export function appNameIn(folder: string): string {
  for (const entry of readdirSync(folder).toSorted()) {
    if (!entry.endsWith(".ts") || entry.endsWith(".test.ts")) continue;
    const name = /"app\.name":\s*"([^"]+)"/.exec(readFileSync(join(folder, entry), "utf8"))?.[1];
    if (name !== undefined) return name;
  }
  throw new Error(`No "app.name" message in ${folder}`);
}

/** What's wrong with the help pages under `root`, the repository; none when all is well. */
export function checkHelp(root: string): readonly string[] {
  const folder = join(root, HELP_PATHS.pages);
  const files = readdirSync(folder)
    .filter((name) => name.endsWith(".md") && name !== "README.md")
    .toSorted()
    .map((name) => ({ name, text: readFileSync(join(folder, name), "utf8") }));
  const catalogue = JSON.parse(readFileSync(join(root, HELP_PATHS.catalogue), "utf8")) as {
    components: Record<string, unknown>;
  };
  return checkHelpPages({
    files,
    componentTypes: Object.keys(catalogue.components),
    appName: appNameIn(join(root, HELP_PATHS.strings)),
  });
}

/** Checks the help pages under `root` and says what it found; sets a failing exit code if any. */
export function main(root = process.cwd()): void {
  const problems = checkHelp(root);
  if (problems.length > 0) {
    console.error(`The help pages in ${HELP_PATHS.pages} have ${problems.length} problem(s):`);
    for (const problem of problems) console.error(`  ${problem}`);
    console.error("The rules are in docs/help/README.md.");
    process.exitCode = 1;
    return;
  }
  console.log(`The help pages in ${HELP_PATHS.pages} are all in order.`);
}

if (import.meta.main) {
  main();
}
