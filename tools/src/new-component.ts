// New site component scaffold (2.19): writes a component family's module, story, test and
// strings, registers the family with the catalogue and the strings, gives it a heading on a help
// page and regenerates the catalogue's data. What it writes passes `pnpm check` and renders in
// Storybook as it is; then fill it in (docs/components.md).
//
// Usage:
//   pnpm new-component <Name> --place section|element|child --help-page <page> [--category <name>]
//
//   <Name>        the component type, in PascalCase, stored in every site file: never renamed later
//   --place       a page band (section), something inside one (element), or an item of another's
//                 repeating list (child)
//   --help-page   the page in docs/help that explains it, such as sections or elements (HP-4)
//   --category    the Add panel's group it joins, one there is already, such as text or media
//                 (`category.text`); a section's or an element's, not a child's (#979)
//
// This file has no relative imports so Node can run it directly with type stripping.

import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** Where a component goes: see `ComponentPlace` in site-components. */
export type Place = "section" | "element" | "child";

/** A component's names, from its type: `PriceList`. */
export type Names = {
  /** Its type, in site files: "PriceList". */
  readonly type: string;
  /** Its family's file name, and its `site-<file>` class: "price-list". */
  readonly file: string;
  /** Its family's names in code: "priceList" (`priceListComponents`, the strings' `priceList`). */
  readonly camel: string;
  /** Its English name, until someone words it: "Price list". */
  readonly label: string;
};

/** A component type: PascalCase, letters and digits. */
const TYPE = /^[A-Z][A-Za-z0-9]*$/;

/** The names of component `type`, or why it can't be one. */
export function namesOf(type: string): Names | string {
  if (!TYPE.test(type))
    return `"${type}" isn't a component type: use PascalCase, such as PriceList`;
  const words = type.split(/(?=[A-Z])/);
  return {
    type,
    file: words.map((word) => word.toLowerCase()).join("-"),
    camel: type.charAt(0).toLowerCase() + type.slice(1),
    label: [words[0], ...words.slice(1).map((word) => word.toLowerCase())].join(" "),
  };
}

/** The strings key of a component's name: `section.priceList`, `element.priceList`. */
function labelKey(names: Names, place: Place): string {
  return `${place === "section" ? "section" : "element"}.${names.camel}`;
}

/** The family's strings file: its name and its starter text. Its Add-panel group is another's. */
export function stringsFile(names: Names, place: Place): string {
  const lines = [
    "/**",
    ` * The ${names.file} family (\`catalogue/${names.file}.tsx\`): the ${names.label}.`,
    " */",
    `export const ${names.camel} = {`,
    `  "${labelKey(names, place)}": "${names.label}",`,
    ...(place === "section" ? [`  "starter.${names.camel}Title": "${names.label}",`] : []),
    `  "starter.${names.camel}Text": "Say what this ${names.label.toLowerCase()} shows.",`,
    "} as const;",
    "",
  ];
  return lines.join("\n");
}

/**
 * The family's module: the component, defined by its place, drawn with the primitives; a section or
 * an element in the Add panel's `category` (`text`, for `category.text`).
 */
export function moduleFile(names: Names, place: Place, category = ""): string {
  const { camel, file, type } = names;
  const doc = `/** The ${names.label}. Say in a sentence what it shows, and how (docs/components.md). */`;
  const family = [
    "",
    `/** The ${names.label} family. */`,
    `export const ${camel}Components: Readonly<Record<string, ComponentDef>> = {`,
    `  ${type}: ${camel},`,
    "};",
    "",
  ];
  if (place === "section") {
    return [
      'import { t } from "@webforge/i18n";',
      'import { contentWidthClass, defineSection } from "../frame.js";',
      'import type { ComponentDef } from "../library.js";',
      'import { BodyText, SectionTitle } from "../typography.js";',
      "",
      doc,
      `const ${camel} = defineSection({`,
      `  label: t("${labelKey(names, place)}"),`,
      `  name: "${file}",`,
      `  category: t("category.${category}"),`,
      "  fields: {",
      '    title: { kind: "text", label: t("field.title"), inline: true },',
      '    text: { kind: "richtext", label: t("field.text"), inline: true },',
      "  },",
      "  defaults: {",
      `    title: t("starter.${camel}Title"),`,
      `    text: \`<p>\${t("starter.${camel}Text")}</p>\`,`,
      '    contentWidth: "narrow",',
      "  },",
      '  frame: () => "bg-base-100",',
      "  render: ({ values }) => (",
      `    <div className={\`mx-auto \${contentWidthClass(values.contentWidth)}\`}>`,
      "      <SectionTitle>{values.title}</SectionTitle>",
      '      <BodyText className="mt-4">{values.text}</BodyText>',
      "    </div>",
      "  ),",
      "});",
      ...family,
    ].join("\n");
  }
  if (place === "element") {
    return [
      'import { t } from "@webforge/i18n";',
      'import { defineComponent } from "../define.js";',
      'import { MARGIN_FIELD, marginClasses } from "../frame.js";',
      'import type { ComponentDef } from "../library.js";',
      'import { BodyText } from "../typography.js";',
      "",
      doc,
      `const ${camel} = defineComponent({`,
      `  label: t("${labelKey(names, place)}"),`,
      `  category: t("category.${category}"),`,
      "  fields: {",
      '    text: { kind: "richtext", label: t("field.text"), inline: true },',
      "    margin: MARGIN_FIELD,",
      "  },",
      `  defaults: { text: \`<p>\${t("starter.${camel}Text")}</p>\` },`,
      "  render: ({ values }) => (",
      `    <div className={\`site-${file}\${marginClasses(values.margin)}\`}>`,
      "      <BodyText>{values.text}</BodyText>",
      "    </div>",
      "  ),",
      "});",
      ...family,
    ].join("\n");
  }
  return [
    'import { t } from "@webforge/i18n";',
    'import { defineComponent } from "../define.js";',
    'import type { ComponentDef } from "../library.js";',
    "",
    `/** One item of another component's repeating list: add "${type}" to that slot's \`allow\`. */`,
    `const ${camel} = defineComponent({`,
    `  label: t("${labelKey(names, place)}"),`,
    '  place: "child",',
    "  fields: {",
    '    text: { kind: "text", label: t("field.text"), inline: true },',
    "  },",
    `  defaults: { text: t("starter.${camel}Text") },`,
    `  render: ({ values }) => <div className="site-${file}">{values.text}</div>,`,
    "});",
    ...family,
  ].join("\n");
}

/** The family's story, rendered with the export's renderer like every other. */
export function storyFile(names: Names): string {
  return [
    'import type { Meta, StoryObj } from "@storybook/react-vite";',
    'import { SiteNodes } from "../stories/site-nodes.js";',
    'import { siteLibrary } from "./index.js";',
    "",
    "const meta = {",
    `  title: "Site components/${names.label}",`,
    "  component: SiteNodes,",
    "} satisfies Meta<typeof SiteNodes>;",
    "export default meta;",
    "type Story = StoryObj<typeof meta>;",
    "",
    `/** The ${names.label} as it starts. Add a story for each of its layouts. */`,
    `export const ${names.type}: Story = {`,
    "  args: {",
    "    nodes: [",
    "      {",
    `        type: "${names.type}",`,
    `        props: { id: "${names.file}", ...siteLibrary.components.${names.type}?.defaults },`,
    "      },",
    "    ],",
    "  },",
    "};",
    "",
  ].join("\n");
}

/** The family's test: it renders, with its starter text. Test what its render works out. */
export function testFile(names: Names): string {
  return [
    'import { t } from "@webforge/i18n";',
    'import { describe, expect, it } from "vitest";',
    'import { EDITOR_RENDER_CONTEXT } from "../library.js";',
    'import { renderNodesToHtml } from "../render-static.js";',
    'import { siteLibrary } from "./index.js";',
    "",
    `describe("the ${names.label}", () => {`,
    '  it("renders with its starter text, as the Add panel places it", () => {',
    `    const defaults = siteLibrary.components.${names.type}?.defaults;`,
    "    const html = renderNodesToHtml(",
    `      [{ type: "${names.type}", props: { id: "${names.file}", ...defaults } }],`,
    "      siteLibrary,",
    "      EDITOR_RENDER_CONTEXT,",
    "    );",
    "",
    `    expect(html).toContain('class="site-${names.file}');`,
    `    expect(html).toContain(t("starter.${names.camel}Text"));`,
    "  });",
    "});",
    "",
  ].join("\n");
}

/**
 * `index` (the catalogue's `src/catalogue/index.ts`) with the family registered: imported, and
 * listed last in `createLibrary`.
 */
export function registerInCatalogue(index: string, names: Names): string {
  const imports = index.lastIndexOf('from "./');
  const afterImports = index.indexOf("\n", imports) + 1;
  const withImport = `${index.slice(0, afterImports)}import { ${names.camel}Components } from "./${names.file}.js";\n${index.slice(afterImports)}`;
  const close = withImport.indexOf(");", withImport.indexOf("createLibrary("));
  if (close === -1) throw new Error("No createLibrary( … ) in the catalogue's index");
  return `${withImport.slice(0, close)}  ${names.camel}Components,\n${withImport.slice(close)}`;
}

/**
 * `index` (the strings' `en/components/index.ts`) with the family registered: imported, in
 * `componentFamilies` and in `components`.
 */
export function registerInStrings(index: string, names: Names): string {
  const imports = index.lastIndexOf('from "./');
  const afterImports = index.indexOf("\n", imports) + 1;
  let text = `${index.slice(0, afterImports)}import { ${names.camel} } from "./${names.camel}.js";\n${index.slice(afterImports)}`;
  // On one line or wrapped by the formatter: rebuilt from its names, with the new one last.
  text = text.replace(
    /export const componentFamilies = \{([^}]*)\} as const;/,
    (_declaration, inside: string) => {
      const families = inside
        .split(",")
        .map((name) => name.trim())
        .filter((name) => name !== "");
      return `export const componentFamilies = { ${[...families, names.camel].join(", ")} } as const;`;
    },
  );
  const spread = text.lastIndexOf("} as const;");
  return `${text.slice(0, spread)}  ...${names.camel},\n${text.slice(spread)}`;
}

const CATALOGUE = "packages/site-components/src/catalogue";
const STRINGS = "packages/i18n/src/en/components";

/**
 * The component types the catalogue's modules at `root` define: the keys of each family's record
 * (`export const sectionsComponents … = { Hero: hero, … }`).
 */
export function catalogueTypes(root: string): Set<string> {
  const types = new Set<string>();
  const folder = join(root, CATALOGUE);
  for (const file of readdirSync(folder)) {
    if (!file.endsWith(".tsx") || /\.(test|stories)\.tsx$/.test(file)) continue;
    const text = readFileSync(join(folder, file), "utf8");
    for (const record of text.matchAll(/export const \w+Components\b[^=]*=\s*\{([^}]*)\}/g)) {
      for (const key of (record[1] ?? "").matchAll(/(\w+)\s*:/g)) {
        if (key[1] !== undefined) types.add(key[1]);
      }
    }
  }
  return types;
}

/**
 * The Add panel's groups the strings at `root` have: `text` for `category.text`, from every
 * family's strings file.
 */
export function categoriesIn(root: string): Set<string> {
  const categories = new Set<string>();
  const folder = join(root, STRINGS);
  for (const file of readdirSync(folder)) {
    if (!file.endsWith(".ts") || file.endsWith(".test.ts")) continue;
    for (const key of readFileSync(join(folder, file), "utf8").matchAll(/"category\.(\w+)"\s*:/g)) {
      if (key[1] !== undefined) categories.add(key[1]);
    }
  }
  return categories;
}

const HELP = "docs/help";

/** The heading a help page gets for a new component, and a line to word in its place (HP-4). */
function helpStub(names: Names): string {
  const name = names.label.toLowerCase();
  return `## ${names.label}\n\nSay what the ${name} is for, and what you can change in it.\n`;
}

/**
 * `page`, a help page's Markdown, with component `names` on it (HP-4): its type in the front
 * matter's `components`, a heading named after it at the end for *Help for this element*, and
 * `updated` set to `today`.
 */
export function registerInHelpPage(page: string, names: Names, today: string): string {
  const end = page.indexOf("\n---", 3);
  if (!page.startsWith("---") || end === -1) throw new Error("The help page has no front matter");
  let front = page.slice(0, end);
  const listed = /^components: \[(.*)\]$/m;
  front = listed.test(front)
    ? front.replace(listed, (_line, inside: string) => {
        const types = inside
          .split(",")
          .map((type) => type.trim())
          .filter((type) => type !== "");
        return `components: [${[...types, names.type].join(", ")}]`;
      })
    : `${front}\ncomponents: [${names.type}]`;
  front = front.replace(/^updated: .*$/m, `updated: ${today}`);
  return `${front}${page.slice(end).trimEnd()}\n\n${helpStub(names)}`;
}

/** What {@link newComponent} writes: the component and where it goes. */
export type NewComponentRequest = {
  /** Its type, in PascalCase: `PriceList`. */
  readonly type: string;
  readonly place: Place;
  /** The help page that explains it, by its id: `sections` (`docs/help/sections.md`). */
  readonly helpPage: string;
  /** The Add panel's group it joins, one there is already: `text`. Not for a child. */
  readonly category?: string | undefined;
};

/** What {@link newComponent} does after writing, in the repository at `root`. */
export type NewComponentSteps = {
  /** Formats the files written as the repository formats its files; whether it could. */
  readonly format: ((files: readonly string[], root: string) => boolean) | false;
  /** Regenerates `catalogue-data.json` from the catalogue with the new family; whether it could. */
  readonly catalogueData: ((root: string) => boolean) | false;
  /** Today, `2026-11-14`, for the help page's `updated`. */
  readonly today: string;
};

/** What {@link newComponent} did: the files it wrote, and whether each step after worked. */
export type NewComponentResult = {
  readonly written: string[];
  readonly formatted: boolean;
  readonly catalogueData: boolean;
};

/** Runs `pnpm <args>` in the repository at `root`; false if it failed. */
function pnpm(args: readonly string[], root: string): boolean {
  return spawnSync("pnpm", args, { cwd: root, stdio: "ignore", shell: true }).status === 0;
}

const STEPS: NewComponentSteps = {
  format: (files, root) => pnpm(["exec", "biome", "check", "--write", ...files], root),
  catalogueData: (root) => pnpm(["catalogue-data"], root),
  today: new Date().toISOString().slice(0, 10),
};

/**
 * Writes the family of component `request.type` in the repository at `root` and puts it on its
 * help page, then formats what it wrote and regenerates the catalogue's data (`steps`; `false`
 * skips one). Everything is worked out before anything is written, so a refusal leaves nothing
 * behind.
 */
export function newComponent(
  request: NewComponentRequest,
  root = ".",
  steps: Partial<NewComponentSteps> = {},
): NewComponentResult {
  const { place, helpPage } = request;
  const { format, catalogueData, today } = { ...STEPS, ...steps };
  const names = namesOf(request.type);
  if (typeof names === "string") throw new Error(names);
  if (catalogueTypes(root).has(names.type)) {
    throw new Error(`The catalogue has a ${names.type} already: pick another name`);
  }
  const category = request.category ?? "";
  if (place === "child" && category !== "") {
    throw new Error("A child has no --category: it's added inside its parent, not from Add");
  }
  const categories = categoriesIn(root);
  if (place !== "child" && !categories.has(category)) {
    const known = [...categories].toSorted().join(", ");
    throw new Error(`--category must be a group the Add panel has: ${known}`);
  }
  const page = `${HELP}/${helpPage}.md`;
  if (!/^[a-z0-9-]+$/.test(helpPage) || !existsSync(join(root, page))) {
    throw new Error(`--help-page must be a page in ${HELP}, such as sections: no ${page}`);
  }
  const catalogue = `${CATALOGUE}/index.ts`;
  const strings = `${STRINGS}/index.ts`;
  const files: Record<string, string> = {
    [`${CATALOGUE}/${names.file}.tsx`]: moduleFile(names, place, category),
    [`${CATALOGUE}/${names.file}.stories.tsx`]: storyFile(names),
    [`${CATALOGUE}/${names.file}.test.tsx`]: testFile(names),
    [`${STRINGS}/${names.camel}.ts`]: stringsFile(names, place),
  };
  for (const path of Object.keys(files)) {
    if (existsSync(join(root, path))) throw new Error(`${path} exists already: pick another name`);
  }
  // The indexes and the help page too, before anything is written.
  files[catalogue] = registerInCatalogue(readFileSync(join(root, catalogue), "utf8"), names);
  files[strings] = registerInStrings(readFileSync(join(root, strings), "utf8"), names);
  const help = registerInHelpPage(readFileSync(join(root, page), "utf8"), names, today);
  for (const [path, text] of Object.entries(files)) writeFileSync(join(root, path), text);
  writeFileSync(join(root, page), help);
  const code = Object.keys(files);
  // As the repository formats them: imports sorted, long lines wrapped. Then the catalogue's data,
  // which help-check and a site-components test read, with the family in it.
  const formatted = format !== false && format(code, root);
  return {
    written: [...code, page],
    formatted,
    catalogueData: catalogueData !== false && catalogueData(root),
  };
}

/** The value of option `name` in `args`, if it has one. */
function optionIn(args: readonly string[], name: string): string | undefined {
  const at = args.indexOf(name);
  const value = at === -1 ? undefined : args[at + 1];
  return value === undefined || value.startsWith("--") ? undefined : value;
}

/** `--place`'s value in `args`, if it is one. */
function placeIn(args: readonly string[]): Place | undefined {
  const value = optionIn(args, "--place");
  return value === "section" || value === "element" || value === "child" ? value : undefined;
}

const USAGE =
  "Usage: pnpm new-component <Name> --place section|element|child --help-page <page> [--category <name>]\n";

/** The command: writes the component `args` describe, setting the exit code when it fails. */
export function main(
  args: readonly string[] = process.argv.slice(2),
  { root = ".", steps = {} }: { root?: string; steps?: Partial<NewComponentSteps> } = {},
): void {
  const [type] = args;
  const place = placeIn(args);
  const helpPage = optionIn(args, "--help-page");
  if (type === undefined || type.startsWith("--") || place === undefined || !helpPage) {
    process.stderr.write(USAGE);
    process.exitCode = 1;
    return;
  }
  try {
    const category = optionIn(args, "--category");
    const result = newComponent({ type, place, helpPage, category }, root, steps);
    for (const path of result.written) process.stdout.write(`wrote ${path}\n`);
    if (!result.formatted) process.stderr.write("formatting failed: run pnpm format\n");
    if (!result.catalogueData) process.stderr.write("its data failed: run pnpm catalogue-data\n");
    if (result.formatted && result.catalogueData) {
      process.stdout.write(
        "Next: fill it in (docs/components.md) and word its help page's heading, then pnpm check.\n",
      );
    } else {
      process.exitCode = 1;
    }
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}

if (import.meta.main) {
  main();
}
