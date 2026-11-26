// New template scaffold (#983): writes a template's folder from Blank's (Home, About and Contact as
// short skeletons, no photos), for one business type, with its strings and a row on the templates
// help page, then regenerates the template index. What it writes passes `pnpm check` as it is,
// but for its thumbnail: `pnpm template-thumbnails` draws that, in Docker. Then fill it in.
//
// Usage:
//   pnpm new-template <id> --type <business type>
//
//   <id>     the template's id, in lower case with hyphens (`photo-studio`), stored in no site
//            but its folder's and strings' name: keep it
//   --type   the business type New Site lists it under, one the model has, such as food or trades
//
// This file has no relative imports so Node can run it directly with type stripping.

import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** The templates' folders, from the repository root. */
const TEMPLATES_FOLDER = "packages/templates/templates";

/** Where the business types are listed, in their order, from the repository root. */
const BUSINESS_TYPES_FILE = "packages/model/src/settings.ts";

/**
 * The business types, as the model lists them in `root`: as `build-template-index.ts` reads them,
 * since a tool Node runs directly can't import another.
 */
function businessTypesIn(root: string): string[] {
  const text = readFileSync(join(root, BUSINESS_TYPES_FILE), "utf8");
  const list = /export const BUSINESS_TYPES = \[([^\]]*)\]/.exec(text)?.[1];
  if (list === undefined) throw new Error(`No BUSINESS_TYPES in ${BUSINESS_TYPES_FILE}`);
  return [...list.matchAll(/"([a-z]+)"/g)].map((match) => match[1] ?? "");
}

/** Runs `command` in the repository at `root`; false if it failed. */
const run = (command: string, root: string) =>
  spawnSync(command, { cwd: root, stdio: "ignore", shell: true }).status === 0;

/** The template every new one starts from. */
const BLANK = `${TEMPLATES_FOLDER}/blank`;

/** The templates' strings, from the repository root. */
const STRINGS = "packages/i18n/src/en/templates.ts";

/** The templates' help page, from the repository root. */
const HELP_PAGE = "docs/help/templates.md";

/** What {@link newTemplate} does after writing, in the repository at `root`. */
export type NewTemplateSteps = {
  /** Regenerates the template index and formats what was written; whether it could. */
  readonly finish: ((files: readonly string[], root: string) => boolean) | false;
  /** Today, `2026-11-15`, for the help page's `updated`. */
  readonly today: string;
};

const STEPS: NewTemplateSteps = {
  // One command line each: the paths are the repository's own, nothing to escape.
  finish: (files, root) =>
    run("pnpm template-index", root) &&
    run(`pnpm exec biome format --write ${files.join(" ")}`, root),
  today: new Date().toISOString().slice(0, 10),
};

/** `photo-studio`'s name until it's worded: "Photo studio". */
const nameOf = (id: string) => {
  const words = id.split("-").join(" ");
  return `${words.charAt(0).toUpperCase()}${words.slice(1)}`;
};

/** `text` with `entries` added before Blank's strings, the last of the templates'. */
function withStrings(text: string, id: string, name: string): string {
  const blank = '  "template.blank.name"';
  if (!text.includes(blank)) throw new Error(`${STRINGS} has no template.blank.name to add before`);
  const entries = [
    `  "template.${id}.name": ${JSON.stringify(name)},`,
    `  "template.${id}.description":`,
    `    ${JSON.stringify("Home, About and Contact pages to fill in: say who it's for and what each page holds.")},`,
  ].join("\n");
  return text.replace(blank, `${entries}\n${blank}`);
}

/** The type's name in the help page's table, as the strings give it: "Food and drink". */
function typeNameIn(strings: string, type: string): string {
  const match = new RegExp(`"template\\.category\\.${type}": "([^"]*)"`).exec(strings);
  return match?.[1] ?? type;
}

/** `page` with a row for the template before Blank's, and updated `today` (HP-4). */
function withHelpRow(page: string, name: string, type: string, today: string): string {
  const blank = /^\| Blank site .*$/m.exec(page);
  if (blank === null) throw new Error(`${HELP_PAGE} has no row for Blank site to add before`);
  // The table's columns, as wide as Blank's row has them.
  const widths = blank[0]
    .split("|")
    .slice(1, -1)
    .map((cell) => cell.length - 2);
  const cells = [name, type, "Light", "Home, About, Contact"];
  const row = `| ${cells.map((cell, at) => cell.padEnd(widths[at] ?? 0)).join(" | ")} |`;
  return page
    .replace(blank[0], `${row}\n${blank[0]}`)
    .replace(/^updated: .*$/m, `updated: ${today}`);
}

/**
 * Writes template `id` for business type `type` in the repository at `root`, from Blank's folder:
 * its `template.json`, an empty `images.json` and Blank's thumbnail for now; its strings; and a
 * row on the templates help page. Then regenerates the index and formats (`steps`; `false` skips
 * it). Everything is checked before anything is written, so a refusal leaves nothing behind.
 */
export function newTemplate(
  id: string,
  type: string,
  root = ".",
  steps: Partial<NewTemplateSteps> = {},
): { readonly written: string[]; readonly finished: boolean } {
  const { finish, today } = { ...STEPS, ...steps };
  if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(id) || id.length > 40) {
    throw new Error("The id is lower case words joined by hyphens, such as photo-studio");
  }
  const folder = `${TEMPLATES_FOLDER}/${id}`;
  if (existsSync(join(root, folder))) throw new Error(`${folder} exists already: pick another id`);
  const types = businessTypesIn(root);
  if (!types.includes(type)) throw new Error(`--type must be a business type: ${types.join(", ")}`);
  const strings = readFileSync(join(root, STRINGS), "utf8");
  if (strings.includes(`"template.${id}.name"`)) {
    throw new Error(`${STRINGS} has template.${id} already: pick another id`);
  }
  const name = nameOf(id);
  const blank = JSON.parse(readFileSync(join(root, BLANK, "template.json"), "utf8")) as Record<
    string,
    unknown
  >;
  const template = { ...blank, id, category: type, example: false };
  const help = withHelpRow(
    readFileSync(join(root, HELP_PAGE), "utf8"),
    name,
    typeNameIn(strings, type),
    today,
  );
  const added = withStrings(strings, id, name);
  mkdirSync(join(root, folder));
  writeFileSync(join(root, folder, "template.json"), `${JSON.stringify(template, null, 2)}\n`);
  writeFileSync(join(root, folder, "images.json"), "[]\n");
  copyFileSync(join(root, BLANK, "thumbnail.png"), join(root, folder, "thumbnail.png"));
  writeFileSync(join(root, STRINGS), added);
  writeFileSync(join(root, HELP_PAGE), help);
  const written = [
    `${folder}/template.json`,
    `${folder}/images.json`,
    `${folder}/thumbnail.png`,
    STRINGS,
    HELP_PAGE,
  ];
  const finished = finish !== false && finish([`${folder}/template.json`, STRINGS], root);
  return { written, finished };
}

/** The value of option `name` in `args`, if it has one. */
function optionIn(args: readonly string[], name: string): string | undefined {
  const at = args.indexOf(name);
  const value = at === -1 ? undefined : args[at + 1];
  return value === undefined || value.startsWith("--") ? undefined : value;
}

const USAGE = "Usage: pnpm new-template <id> --type <business type>\n";

/** The command: writes the template `args` describe, setting the exit code when it fails. */
export function main(
  args: readonly string[] = process.argv.slice(2),
  { root = ".", steps = {} }: { root?: string; steps?: Partial<NewTemplateSteps> } = {},
): void {
  const [id] = args;
  const type = optionIn(args, "--type");
  if (id === undefined || id.startsWith("--") || type === undefined) {
    process.stderr.write(USAGE);
    process.exitCode = 1;
    return;
  }
  try {
    const result = newTemplate(id, type, root, steps);
    for (const path of result.written) process.stdout.write(`wrote ${path}\n`);
    if (!result.finished) {
      process.stderr.write(
        "the index or formatting failed: run pnpm template-index, then pnpm format\n",
      );
      process.exitCode = 1;
      return;
    }
    process.stdout.write(
      [
        "Next: fill it in, its pages, theme and pictures (docs/extending.md), and word its strings",
        "and its row on the templates help page. Then draw its thumbnail with",
        "pnpm template-thumbnails, which needs Docker running: until then it has Blank's, which",
        "CI's Storybook job finds out of date. Then pnpm check:quick, which writes its export's golden",
        "files and Site Check's snapshot the first time: commit them with it.\n",
      ].join("\n"),
    );
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}

if (import.meta.main) main();
