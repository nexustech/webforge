// Template index build (#983): writes `packages/templates/src/template-index.ts`, the templates
// Webforge ships, from the folders of `packages/templates/templates/`: their ids, in New Site's
// order, and each one's image manifest. A test in the templates package checks that it matches
// them.
//
// Usage, after adding, renaming or removing a template's folder (`pnpm new-template` runs it):
//   pnpm template-index
//
// This file has no relative imports so Node can run it directly with type stripping.

import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** The templates' folders, from the repository root. */
export const TEMPLATES_FOLDER = "packages/templates/templates";

/** The module written, from the repository root. */
export const TEMPLATE_INDEX = "packages/templates/src/template-index.ts";

/** Where the business types are listed, in their order, from the repository root. */
const BUSINESS_TYPES_FILE = "packages/model/src/settings.ts";

/** A template as the index needs it: its folder's name, its id, and its business type. */
export type IndexedTemplate = { readonly id: string; readonly category: string | null };

/**
 * The name the module imports `id`'s manifest by: `photo-studio`'s as `photoStudioImages`. Never the
 * bare id, which could be a reserved word (`case`).
 */
const identifierOf = (id: string) =>
  `${id.replace(/-([a-z0-9])/g, (_, letter: string) => letter.toUpperCase())}Images`;

/**
 * `templates` in New Site's order: by business type, as `types` lists them, then those without one
 * (Blank); by id within each.
 */
export function inNewSiteOrder(
  templates: readonly IndexedTemplate[],
  types: readonly string[],
): IndexedTemplate[] {
  const rank = (template: IndexedTemplate) =>
    template.category === null ? types.length : types.indexOf(template.category);
  return templates.toSorted((a, b) => rank(a) - rank(b) || a.id.localeCompare(b.id));
}

/** The module for `templates`, already in the order New Site lists them. */
export function templateIndexModule(templates: readonly IndexedTemplate[]): string {
  const imports = templates
    .toSorted((a, b) => a.id.localeCompare(b.id))
    .map(
      ({ id }) =>
        `import ${identifierOf(id)} from "../templates/${id}/images.json" with { type: "json" };`,
    );
  return [
    "// Generated from the folders of `packages/templates/templates/` by `pnpm template-index`",
    "// (tools/src/build-template-index.ts): don't edit it by hand. A test checks that it matches them.",
    "",
    ...imports,
    "",
    "/**",
    " * The templates Webforge ships (2.14a, F-SITE-1, S2), by id: each a folder of this package's",
    " * `templates/` with its `template.json` and `images.json`, in New Site's order: by business type,",
    " * as `BUSINESS_TYPES` lists them, then Blank. Their names and descriptions are",
    ' * `t("template.<id>.name")` and `t("template.<id>.description")`.',
    " */",
    "export const TEMPLATE_IDS = [",
    ...templates.map(({ id }) => `  ${JSON.stringify(id)},`),
    "] as const;",
    "",
    "/** Each template's image manifest (`images.json`), by id. */",
    "export const TEMPLATE_MANIFESTS = {",
    ...templates
      .toSorted((a, b) => a.id.localeCompare(b.id))
      .map(({ id }) => `  ${JSON.stringify(id)}: ${identifierOf(id)},`),
    "};",
    "",
  ].join("\n");
}

/** The business types, in their order, as the model lists them in `root`. */
export function businessTypesIn(root: string): string[] {
  const text = readFileSync(join(root, BUSINESS_TYPES_FILE), "utf8");
  const list = /export const BUSINESS_TYPES = \[([^\]]*)\]/.exec(text)?.[1];
  if (list === undefined) throw new Error(`No BUSINESS_TYPES in ${BUSINESS_TYPES_FILE}`);
  return [...list.matchAll(/"([a-z]+)"/g)].map((match) => match[1] ?? "");
}

/** The templates in `root`'s folders, each with its id and business type from `template.json`. */
export function templatesIn(root: string): IndexedTemplate[] {
  const folder = join(root, TEMPLATES_FOLDER);
  return readdirSync(folder, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(join(folder, entry.name, "template.json")))
    .map((entry) => {
      const json = JSON.parse(readFileSync(join(folder, entry.name, "template.json"), "utf8")) as {
        readonly id?: unknown;
        readonly category?: unknown;
      };
      if (json.id !== entry.name) {
        throw new Error(
          `${entry.name}/template.json has the id ${String(json.id)}: give it ${entry.name}`,
        );
      }
      return { id: entry.name, category: typeof json.category === "string" ? json.category : null };
    });
}

/** Writes the index for `root`'s templates, formatted as the repository formats it. */
export function buildTemplateIndex(root = "."): void {
  const templates = inNewSiteOrder(templatesIn(root), businessTypesIn(root));
  writeFileSync(join(root, TEMPLATE_INDEX), templateIndexModule(templates));
  // One command line: the path is the repository's own, nothing to escape.
  spawnSync(`pnpm exec biome format --write ${TEMPLATE_INDEX}`, {
    cwd: root,
    stdio: "ignore",
    shell: true,
  });
}

if (import.meta.main) buildTemplateIndex();
