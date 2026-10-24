// New site component scaffold (2.19): writes a component family's module, story, test and
// strings, and registers the family with the catalogue and the strings. What it writes passes
// `pnpm check` and renders in Storybook as it is; then fill it in (docs/components.md).
//
// Usage:
//   pnpm new-component <Name> --place section|element|child
//
//   <Name>   the component type, in PascalCase, stored in every site file: never renamed later
//   --place  a page band (section), something inside one (element), or an item of another's
//            repeating list (child)
//
// This file has no relative imports so Node can run it directly with type stripping.

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

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

/** The family's strings file: its name, its group in the Add panel and its starter text. */
export function stringsFile(names: Names, place: Place): string {
  const lines = [
    "/**",
    ` * The ${names.file} family (\`catalogue/${names.file}.tsx\`): the ${names.label}.`,
    " */",
    `export const ${names.camel} = {`,
    `  "${labelKey(names, place)}": "${names.label}",`,
    ...(place === "child" ? [] : [`  "category.${names.camel}": "${names.label}",`]),
    ...(place === "section" ? [`  "starter.${names.camel}Title": "${names.label}",`] : []),
    `  "starter.${names.camel}Text": "Say what this ${names.label.toLowerCase()} shows.",`,
    "} as const;",
    "",
  ];
  return lines.join("\n");
}

/** The family's module: the component, defined by its place, drawn with the primitives. */
export function moduleFile(names: Names, place: Place): string {
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
      'import { defineSection } from "../frame.js";',
      'import type { ComponentDef } from "../library.js";',
      'import { BodyText, SectionTitle } from "../typography.js";',
      "",
      doc,
      `const ${camel} = defineSection({`,
      `  label: t("${labelKey(names, place)}"),`,
      `  name: "${file}",`,
      `  category: t("category.${camel}"),`,
      "  fields: {",
      '    title: { kind: "text", label: t("field.title"), inline: true },',
      '    text: { kind: "richtext", label: t("field.text"), inline: true },',
      "  },",
      "  defaults: {",
      `    title: t("starter.${camel}Title"),`,
      `    text: \`<p>\${t("starter.${camel}Text")}</p>\`,`,
      "  },",
      '  frame: () => "bg-base-100",',
      "  render: ({ values }) => (",
      '    <div className="mx-auto max-w-3xl">',
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
      `  category: t("category.${camel}"),`,
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
  text = text.replace(
    /(export const componentFamilies = \{[^}]*?)( \} as const;)/,
    `$1, ${names.camel}$2`,
  );
  const spread = text.lastIndexOf("} as const;");
  return `${text.slice(0, spread)}  ...${names.camel},\n${text.slice(spread)}`;
}

const CATALOGUE = "packages/site-components/src/catalogue";
const STRINGS = "packages/i18n/src/en/components";

/** Writes the family of component `type` at `place`, and returns the files it wrote. */
export function newComponent(type: string, place: Place): string[] {
  const names = namesOf(type);
  if (typeof names === "string") throw new Error(names);
  const files: Record<string, string> = {
    [`${CATALOGUE}/${names.file}.tsx`]: moduleFile(names, place),
    [`${CATALOGUE}/${names.file}.stories.tsx`]: storyFile(names),
    [`${CATALOGUE}/${names.file}.test.tsx`]: testFile(names),
    [`${STRINGS}/${names.camel}.ts`]: stringsFile(names, place),
  };
  for (const path of Object.keys(files)) {
    if (existsSync(path)) throw new Error(`${path} exists already: pick another name`);
  }
  for (const [path, text] of Object.entries(files)) writeFileSync(path, text);
  const catalogue = `${CATALOGUE}/index.ts`;
  writeFileSync(catalogue, registerInCatalogue(readFileSync(catalogue, "utf8"), names));
  const strings = `${STRINGS}/index.ts`;
  writeFileSync(strings, registerInStrings(readFileSync(strings, "utf8"), names));
  const written = [...Object.keys(files), catalogue, strings];
  // As the repository formats them: imports sorted, long lines wrapped.
  spawnSync("pnpm", ["exec", "biome", "check", "--write", ...written], {
    stdio: "ignore",
    shell: true,
  });
  return written;
}

/** `--place`'s value in `args`, if it is one. */
function placeIn(args: readonly string[]): Place | undefined {
  const value = args[args.indexOf("--place") + 1];
  return value === "section" || value === "element" || value === "child" ? value : undefined;
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const [type] = args;
  const place = placeIn(args);
  if (type === undefined || type.startsWith("--") || place === undefined) {
    process.stderr.write("Usage: pnpm new-component <Name> --place section|element|child\n");
    process.exit(1);
  }
  try {
    for (const path of newComponent(type, place)) process.stdout.write(`wrote ${path}\n`);
    process.stdout.write("Next: fill it in (docs/components.md), then pnpm check.\n");
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  }
}
