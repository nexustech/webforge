// Editor scaffolds (2.20, B7), beside 2.19's `pnpm new-component`: an area of the editor, a panel,
// commands, a kind of field or an IPC domain, with its strings, story and test, registered where
// the app finds it. What it writes passes `pnpm check` as it is; then fill it in
// (docs/extending.md).
//
// Usage:
//   pnpm scaffold area <Name> [--window]
//   pnpm scaffold panel <Name> [--area <folder>] [--window]
//   pnpm scaffold commands <Name> [--area <folder>] [--window]
//   pnpm scaffold field-kind <Name>
//   pnpm scaffold ipc-domain <Name>
//
//   <Name>    PascalCase: Bookings, OpeningTimes. An IPC domain's is one word (Calendar).
//   --area    the renderer folder the panel or commands go in (bookings); made if it isn't there.
//             Without it, the name's own folder: `panel Notes` goes in notes/
//   --window  registered by the window (WINDOW_AREAS), after the shell's own commands, rather than
//             around the canvas (EDITOR_AREAS): see renderer/areas.ts
//
// This file has no relative imports so Node can run it directly with type stripping.

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

/** What can be scaffolded. */
export type What = "area" | "panel" | "commands" | "field-kind" | "ipc-domain";

const WHATS: readonly What[] = ["area", "panel", "commands", "field-kind", "ipc-domain"];

/** Something's names, from its PascalCase name: `OpeningTimes`. */
export type Names = {
  /** "OpeningTimes": components, types and functions (`OpeningTimesPanel`). */
  readonly pascal: string;
  /** "opening-times": files and folders. */
  readonly file: string;
  /** "openingTimes": values, keys and ids. */
  readonly camel: string;
  /** "Opening times": its English name, until someone words it. */
  readonly label: string;
};

/** The names of `name`, or why it can't be one. */
export function namesOf(name: string): Names | string {
  if (!/^[A-Z][A-Za-z0-9]*$/.test(name))
    return `"${name}" isn't a name: use PascalCase, such as OpeningTimes`;
  const words = name.split(/(?=[A-Z])/);
  return {
    pascal: name,
    file: words.map((word) => word.toLowerCase()).join("-"),
    camel: name.charAt(0).toLowerCase() + name.slice(1),
    label: [words[0], ...words.slice(1).map((word) => word.toLowerCase())].join(" "),
  };
}

/** The camelCase name of folder `folder`: "opening-times" → "openingTimes". */
const camelOf = (folder: string) =>
  folder.replace(/-([a-z0-9])/g, (_, letter: string) => letter.toUpperCase());

/** Folders every area builds on (renderer/shell, editor, testing): not an area's own. */
const BASE = new Set(["shell", "editor", "testing"]);

/** Why `folder` can't hold an area, if it can't. */
export function folderProblem(folder: string): string | undefined {
  if (!/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(folder)) {
    return `"${folder}" isn't a renderer folder: use lower case and hyphens, such as opening-times`;
  }
  if (BASE.has(folder))
    return `renderer/${folder} is what every area builds on, not an area: pick an area's folder`;
  return undefined;
}

const RENDERER = "apps/desktop/src/renderer";
const ROOT_LIST = `${RENDERER}/areas.ts`;
const STRINGS = "packages/i18n/src/en";
const STRINGS_INDEX = "packages/i18n/src/en.ts";

/**
 * What a scaffold does: files it writes, changes to files that exist, and what to do next. Each
 * change takes the file's text and returns the new text, or throws when it can't find its place.
 */
export type Plan = {
  readonly files: Readonly<Record<string, string>>;
  readonly edits: Readonly<Record<string, readonly ((text: string) => string)[]>>;
  readonly next: readonly string[];
};

// Text edits. Each finds its place by what's there and throws when it isn't: the scaffold's tests
// run them on the repository's files, so a moved anchor fails a test before anyone runs it.

/** `text` with `insertion` before `anchor`'s first occurrence (after `from`, if given). */
export function insertBefore(text: string, anchor: string, insertion: string, from = 0): string {
  const at = text.indexOf(anchor, from);
  if (at === -1) throw new Error(`can't find ${JSON.stringify(anchor.trim())}`);
  return `${text.slice(0, at)}${insertion}${text.slice(at)}`;
}

/** `text` with `insertion` after `anchor`'s first occurrence. */
export function insertAfter(text: string, anchor: string, insertion: string): string {
  const at = text.indexOf(anchor);
  if (at === -1) throw new Error(`can't find ${JSON.stringify(anchor.trim())}`);
  return `${text.slice(0, at + anchor.length)}${insertion}${text.slice(at + anchor.length)}`;
}

/** `text` with `line` after its last import. */
export function addImportLine(text: string, line: string): string {
  const imports = [...text.matchAll(/^import [^;]*;$/gm)];
  const last = imports.at(-1);
  if (last === undefined) return `${line}\n${text}`;
  const end = last.index + last[0].length + 1;
  return `${text.slice(0, end)}${line}\n${text.slice(end)}`;
}

/**
 * `text` importing `name` from `module`: added to an import of that module if there is one (a
 * type-only import if `type`), else a new import.
 */
export function addImport(text: string, module: string, name: string, type = false): string {
  const escaped = module.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
  const existing = new RegExp(`import ${type ? "type " : ""}\\{([^}]*)\\} from "${escaped}";`).exec(
    text,
  );
  if (existing !== null) {
    const names =
      existing[1]
        ?.split(",")
        .map((each) => each.trim())
        .filter((each) => each !== "") ?? [];
    if (names.includes(name)) return text;
    const replaced = `import ${type ? "type " : ""}{ ${[...names, name].join(", ")} } from "${module}";`;
    return text.replace(existing[0], replaced);
  }
  return addImportLine(text, `import ${type ? "type " : ""}{ ${name} } from "${module}";`);
}

/** `text` with `entry` last in the list or object that `opening` starts and `closing` ends. */
export function addEntry(text: string, opening: string, closing: string, entry: string): string {
  const start = text.indexOf(opening);
  if (start === -1) throw new Error(`can't find ${JSON.stringify(opening)}`);
  const end = text.indexOf(closing, start);
  if (end === -1) throw new Error(`can't find the end of ${JSON.stringify(opening)}`);
  // A closing on a line of its own ("\n}") stays there: the entry goes on the line before it.
  const at = closing.startsWith("\n") ? end + 1 : end;
  return `${text.slice(0, at)}  ${entry}\n${text.slice(at)}`;
}

// Strings: each area's in packages/i18n/src/en/<area>.ts, registered in en.ts.

/** The strings file of renderer folder `folder`, and the name it exports. */
function stringsOf(folder: string) {
  const name = camelOf(folder);
  return { path: `${STRINGS}/${name}.ts`, name };
}

/**
 * Where an area's strings are (packages/i18n/src/en/), when it isn't `<area>.ts`: the areas from
 * before the scaffold share files. An area that keeps none (`fields`, `perf`) isn't listed, and is
 * refused. A scaffolded area gets a file of its own. docs/extending.md lists the same.
 */
export const STRINGS_FILES: Readonly<Record<string, string>> = {
  add: "panels",
  clipboard: "site",
  "code-trust": "site",
  "edit-panel": "canvas",
  "element-menu": "panels",
  layers: "panels",
  links: "panels",
  media: "site",
  menu: "panels",
  preview: "shell",
  settings: "shell",
  "shared-sections": "canvas",
  site: "panels",
  "site-settings": "site",
  start: "site",
  "undo-history": "shell",
};

/** A new strings file, for renderer folder `folder`, with `entries`. */
export function stringsFile(folder: string, label: string, entries: readonly string[]): string {
  const { name } = stringsOf(folder);
  return [
    `/** The ${label} area (\`apps/desktop/src/renderer/${folder}/\`). */`,
    `export const ${name} = {`,
    ...entries.map((entry) => `  ${entry}`),
    "} as const;",
    "",
  ].join("\n");
}

/** en.ts with the strings of renderer folder `folder` registered: imported, in `areas` and `en`. */
export function registerStrings(index: string, folder: string): string {
  const { name } = stringsOf(folder);
  let text = addImportLine(index, `import { ${name} } from "./en/${name}.js";`);
  text = addEntry(text, "export const areas = {", "} as const;", `${name},`);
  return addEntry(text, "export const en = {", "} as const;", `...${name},`);
}

/** A strings file with `entries` added last. */
export const addStrings = (entries: readonly string[]) => (text: string) =>
  insertBefore(
    text,
    "} as const;",
    entries.map((entry) => `  ${entry}\n`).join(""),
    text.lastIndexOf("} as const;"),
  );

/**
 * The strings part of a plan for renderer folder `folder`: a new file, registered, or `entries`
 * added to the folder's file.
 */
function stringsPlan(root: string, folder: string, label: string, entries: readonly string[]) {
  const shared = STRINGS_FILES[folder];
  if (shared !== undefined) {
    return { files: {}, edits: { [`${STRINGS}/${shared}.ts`]: [addStrings(entries)] } };
  }
  const { path } = stringsOf(folder);
  if (existsSync(join(root, path))) return { files: {}, edits: { [path]: [addStrings(entries)] } };
  // An area there is, whose strings are somewhere this doesn't know: never split them.
  if (existsSync(join(root, RENDERER, folder))) {
    throw new Error(
      `renderer/${folder} keeps its strings in a file the scaffold doesn't know: add it to ` +
        "STRINGS_FILES in tools/src/scaffold.ts (and docs/extending.md's list)",
    );
  }
  return {
    files: { [path]: stringsFile(folder, label, entries) },
    edits: { [STRINGS_INDEX]: [(text: string) => registerStrings(text, folder)] },
  };
}

/** The keys the English strings define, in the repository at `root`. */
export function stringKeys(root: string): Set<string> {
  const keys = new Set<string>();
  const folder = join(root, STRINGS);
  for (const entry of readdirSync(folder, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".ts") || entry.name.endsWith(".test.ts")) continue;
    const text = readFileSync(join(entry.parentPath, entry.name), "utf8");
    for (const [, key] of text.matchAll(/^\s+"([\w.]+)":/gm)) if (key !== undefined) keys.add(key);
  }
  return keys;
}

// Areas: each folder's area.ts, listed in the composition root (renderer/areas.ts).

/** Which list an area goes in, and the context it registers with. */
export type Scope = "editor" | "window";

const CONTEXT: Record<Scope, string> = { editor: "EditorContext", window: "WindowContext" };
const LIST: Record<Scope, string> = { editor: "EDITOR_AREAS", window: "WINDOW_AREAS" };

/** One area: the export a folder's area.ts adds. */
export function areaExport(
  name: string,
  id: string,
  scope: Scope,
  doc: string,
  register: string,
): string {
  return [
    "",
    `/** ${doc} */`,
    `export const ${name}: Area<${CONTEXT[scope]}> = {`,
    `  id: "${id}",`,
    `  register: ${register},`,
    "};",
    "",
  ].join("\n");
}

/** A folder's area.ts, with `imports` and `body`. */
function areaFile(scope: Scope, imports: readonly string[], body: string): string {
  return [
    `import type { Area, ${CONTEXT[scope]} } from "../editor/areas.js";`,
    ...imports,
    body,
  ].join("\n");
}

/** A folder's area.ts with `name` added: imports, and the export last. */
export const addArea =
  (scope: Scope, imports: readonly [string, string][], body: string) => (text: string) => {
    let next = addImport(text, "../editor/areas.js", "Area", true);
    next = addImport(next, "../editor/areas.js", CONTEXT[scope], true);
    for (const [module, name] of imports) next = addImport(next, module, name);
    return `${next.trimEnd()}\n${body}`;
  };

/** The composition root with area `name` from renderer folder `folder` listed last in its list. */
export const listArea = (folder: string, name: string, scope: Scope) => (text: string) =>
  addEntry(
    addImport(text, `./${folder}/area.js`, name),
    `export const ${LIST[scope]}`,
    "];",
    `${name},`,
  );

/** The area part of a plan: the folder's area.ts written or added to, and the area listed. */
function areaPlan(
  root: string,
  folder: string,
  scope: Scope,
  imports: readonly [string, string][],
  body: string,
  name: string,
) {
  const path = `${RENDERER}/${folder}/area.ts`;
  const listed = { [ROOT_LIST]: [listArea(folder, name, scope)] };
  if (existsSync(join(root, path))) {
    return { files: {}, edits: { [path]: [addArea(scope, imports, body)], ...listed } };
  }
  const lines = imports.map(([module, imported]) => `import { ${imported} } from "${module}";`);
  return { files: { [path]: areaFile(scope, lines, body) }, edits: listed };
}

// The scaffolds.

/** `pnpm scaffold area`: a new renderer folder, its area listed, and its strings. */
export function areaPlanFor(root: string, names: Names, scope: Scope): Plan {
  const folder = names.file;
  if (existsSync(join(root, RENDERER, folder)))
    throw new Error(`${RENDERER}/${folder} exists already: pick another name`);
  const name = `${names.camel}Area`;
  const body = areaExport(
    name,
    names.camel,
    scope,
    `The ${names.label} area: say what it adds to the editor (docs/extending.md).`,
    "() => {\n    // Register what the area adds (panels, commands, toolbars), and return how to remove it.\n    return () => undefined;\n  }",
  );
  const area = areaPlan(root, folder, scope, [], body, name);
  const strings = stringsPlan(root, folder, names.label, []);
  return {
    files: {
      ...area.files,
      [`${RENDERER}/${folder}/area.test.ts`]: areaTestFile(names, scope),
      ...strings.files,
    },
    edits: { ...area.edits, ...strings.edits },
    next: [
      `Say what the ${names.label} area adds, then register it in ${RENDERER}/${folder}/area.ts,`,
      `or add its parts: pnpm scaffold panel|commands <Name> --area ${folder}${scope === "window" ? " --window" : ""}.`,
    ],
  };
}

function areaTestFile(names: Names, scope: Scope): string {
  return [
    'import { describe, expect, it } from "vitest";',
    `import { ${LIST[scope]} } from "../areas.js";`,
    `import { ${names.camel}Area } from "./area.js";`,
    "",
    `describe("the ${names.label} area", () => {`,
    '  it("is listed in the composition root", () => {',
    `    expect(${LIST[scope]}).toContain(${names.camel}Area);`,
    "  });",
    "});",
    "",
  ].join("\n");
}

/** `pnpm scaffold panel`: a panel, its registration, story, test and strings, as an area. */
export function panelPlanFor(root: string, names: Names, folder: string, scope: Scope): Plan {
  const { pascal, camel, file, label } = names;
  const dir = `${RENDERER}/${folder}`;
  const keys = { title: `${camel}.panelTitle`, empty: `${camel}.panelEmpty` };
  refuseKeys(root, Object.values(keys));
  const register = `register${pascal}Panel`;
  const name = `${camel}PanelArea`;
  const body = areaExport(
    name,
    `${camel}Panel`,
    scope,
    `The ${label} panel.`,
    `({ panels, session }) => ${register}(panels, session)`,
  );
  const area = areaPlan(
    root,
    folder,
    scope,
    [[`./register-${file}-panel.js`, register]],
    body,
    name,
  );
  const strings = stringsPlan(root, folder, label, [
    `"${keys.title}": "${label}",`,
    `"${keys.empty}": "Nothing in {site} to show here yet.",`,
  ]);
  return {
    files: {
      [`${dir}/${pascal}Panel.tsx`]: [
        'import { t } from "@webforge/i18n";',
        'import type { EditorSession } from "../editor/editor-session.js";',
        'import { useDocument } from "../editor/use-document.js";',
        "",
        `/** The ${label} panel: say in a sentence what it shows, and what it lets the person do. */`,
        `export function ${pascal}Panel({ session }: { readonly session: EditorSession }) {`,
        "  const site = useDocument(session, (doc) => doc.settings.general.name);",
        '  return <p className="m-0 p-3 text-sm text-muted-foreground">' +
          `{t("${keys.empty}", { site })}</p>;`,
        "}",
        "",
      ].join("\n"),
      [`${dir}/register-${file}-panel.tsx`]: [
        'import { t } from "@webforge/i18n";',
        'import type { EditorSession } from "../editor/editor-session.js";',
        'import type { PanelRegistry } from "../shell/panels.js";',
        `import { ${pascal}Panel } from "./${pascal}Panel.js";`,
        "",
        `/** Adds the ${label} panel to the right column's bottom. Returns a function that removes it. */`,
        `export function ${register}(panels: PanelRegistry, session: EditorSession): () => void {`,
        `  function ${pascal}() {`,
        `    return <${pascal}Panel session={session} />;`,
        "  }",
        "  return panels.register({",
        `    id: "${camel}",`,
        '    slot: "right.bottom",',
        `    title: t("${keys.title}"),`,
        `    component: ${pascal},`,
        "  });",
        "}",
        "",
      ].join("\n"),
      [`${dir}/register-${file}-panel.stories.tsx`]: [
        'import type { Meta, StoryObj } from "@storybook/react-vite";',
        'import { panelStory } from "../testing/stories.js";',
        `import { ${register} } from "./register-${file}-panel.js";`,
        "",
        `// The ${label} panel as ${register} adds it.`,
        `const meta = { title: "Panels/Registered/${pascal}" } satisfies Meta;`,
        "export default meta;",
        "type Story = StoryObj<typeof meta>;",
        "",
        "/** As the area registers it, on a new site's starter page. */",
        `export const ${pascal}: Story = panelStory((panels, session) => ${register}(panels, session));`,
        "",
      ].join("\n"),
      [`${dir}/${pascal}Panel.test.tsx`]: [
        "// @vitest-environment happy-dom",
        'import { cleanup, render, screen } from "@testing-library/react";',
        'import { t } from "@webforge/i18n";',
        'import { afterEach, describe, expect, it } from "vitest";',
        'import { registriesForTest, sessionWith } from "../testing/fixtures.js";',
        `import { ${pascal}Panel } from "./${pascal}Panel.js";`,
        `import { ${register} } from "./register-${file}-panel.js";`,
        "",
        "afterEach(cleanup);",
        "",
        `describe("the ${label} panel", () => {`,
        `  it("is added to the right column's bottom, and removed again", () => {`,
        "    const { panels } = registriesForTest();",
        `    const remove = ${register}(panels, sessionWith());`,
        "",
        "    expect(panels.list()).toEqual([",
        `      expect.objectContaining({ id: "${camel}", slot: "right.bottom", title: t("${keys.title}") }),`,
        "    ]);",
        "    remove();",
        "    expect(panels.list()).toEqual([]);",
        "  });",
        "",
        '  it("says there is nothing to show yet", () => {',
        "    const session = sessionWith();",
        `    render(<${pascal}Panel session={session} />);`,
        "",
        "    const site = session.history.document.getState().settings.general.name;",
        `    expect(screen.getByText(t("${keys.empty}", { site }))).toBeTruthy();`,
        "  });",
        "});",
        "",
      ].join("\n"),
      ...area.files,
      ...strings.files,
    },
    edits: merge(
      merge(area.edits, strings.edits),
      // The editor's test lists its panels exactly, so one added by mistake fails it: this one
      // joins the list.
      scope === "editor" ? { [EDITOR_TEST]: [(text: string) => listEditorPanel(text, camel)] } : {},
    ),
    next: [
      `Fill in ${dir}/${pascal}Panel.tsx; its story shows it in Storybook (Panels/Registered/${pascal}).`,
    ],
  };
}

const EDITOR_TEST = `${RENDERER}/editor/Editor.test.tsx`;

/** The editor's test with panel `id` in the sorted list of panels it expects. */
export function listEditorPanel(text: string, id: string): string {
  const list = /(\.toSorted\(\),\s*\)\.toEqual\(\[)([^\]]*)(\]\);)/.exec(text);
  if (list === null) throw new Error("can't find the editor's list of panels");
  const ids = [...(list[2] ?? "").matchAll(/"([^"]+)"/g)].map(([, each]) => each ?? "");
  const listed = [...ids, id]
    .toSorted()
    .map((each) => `"${each}"`)
    .join(", ");
  return text.replace(list[0], `${list[1]}${listed}${list[3]}`);
}

/** `pnpm scaffold commands`: a command, its registration, test and strings, as an area. */
export function commandsPlanFor(root: string, names: Names, folder: string, scope: Scope): Plan {
  const { pascal, camel, file, label } = names;
  const dir = `${RENDERER}/${folder}`;
  const key = `command.${camel}`;
  refuseKeys(root, [key]);
  const register = `register${pascal}Commands`;
  const id = `${camelOf(folder)}.${camel}`;
  const name = `${camel}CommandsArea`;
  const body = areaExport(
    name,
    `${camel}Commands`,
    scope,
    `${label}, in the command box.`,
    `({ commands, session }) => ${register}(commands, session)`,
  );
  const area = areaPlan(root, folder, scope, [[`./${file}-commands.js`, register]], body, name);
  const strings = stringsPlan(root, folder, label, [`"${key}": "${label}",`]);
  return {
    files: {
      [`${dir}/${file}-commands.ts`]: [
        'import { t } from "@webforge/i18n";',
        'import type { EditorSession } from "../editor/editor-session.js";',
        'import type { CommandRegistry } from "../shell/commands.js";',
        "",
        "/**",
        ` * Registers ${label} in the command box: say what it does (docs/extending.md). A change to the`,
        ' * site goes through `session.history` as one undo step with a label ("Changed …"); a menu, a',
        " * shortcut or `enabled` go in the command too. Returns a function that removes it.",
        " */",
        `export function ${register}(registry: CommandRegistry, session: EditorSession): () => void {`,
        "  return registry.register({",
        `    id: "${id}",`,
        `    label: t("${key}"),`,
        "    // What it does; until it's filled in, it shows the home page.",
        "    run: () => session.showPage(session.history.document.getState().homePageId),",
        "  });",
        "}",
        "",
      ].join("\n"),
      [`${dir}/${file}-commands.test.ts`]: [
        'import { t } from "@webforge/i18n";',
        'import { describe, expect, it } from "vitest";',
        'import { registriesForTest, sessionWith } from "../testing/fixtures.js";',
        `import { ${register} } from "./${file}-commands.js";`,
        "",
        `describe("${label}", () => {`,
        '  it("is in the command box while it is registered", () => {',
        "    const { commands } = registriesForTest();",
        `    const remove = ${register}(commands, sessionWith());`,
        "",
        `    expect(commands.get("${id}")?.label).toBe(t("${key}"));`,
        "    remove();",
        `    expect(commands.get("${id}")).toBeUndefined();`,
        "  });",
        "});",
        "",
      ].join("\n"),
      ...area.files,
      ...strings.files,
    },
    edits: merge(area.edits, strings.edits),
    next: [`Fill in ${dir}/${file}-commands.ts: what ${label} does, and its test.`],
  };
}

const FIELDS = `${RENDERER}/fields`;

/**
 * `pnpm scaffold field-kind`: a kind of field storing a string, drawn by the app as a text box, in
 * all seven places a kind touches (renderer/fields/field-kinds.ts). Then make it store and draw
 * what it should.
 */
export function fieldKindPlanFor(root: string, names: Names): Plan {
  const { pascal, camel: kind, label } = names;
  const schema = "packages/site-components/src/schema.ts";
  if (readFileSync(join(root, schema), "utf8").includes(`readonly kind: "${kind}"`)) {
    throw new Error(`FieldDef has a "${kind}" kind already: pick another name`);
  }
  const dir = `${FIELDS}/${kind}`;
  const story = `Edit/Fields/${pascal}`;
  return {
    files: {
      [`${dir}/${pascal}Field.tsx`]: [
        'import { type FieldRendererProps, fieldControlClass } from "@webforge/editor-ui";',
        "",
        `/** The Edit panel's ${label.toLowerCase()} field: say in a sentence what it lets the person set. */`,
        `export function ${pascal}Field({`,
        "  id,",
        "  labelId,",
        "  helpId,",
        "  disabled,",
        "  value,",
        "  onChange,",
        "  onCommit,",
        `}: FieldRendererProps<"${kind}">) {`,
        "  return (",
        "    <input",
        "      id={id}",
        "      aria-labelledby={labelId}",
        "      aria-describedby={helpId}",
        "      disabled={disabled}",
        "      className={fieldControlClass}",
        '      value={typeof value === "string" ? value : ""}',
        "      onChange={(event) => onChange(event.target.value)}",
        "      onBlur={onCommit}",
        "    />",
        "  );",
        "}",
        "",
      ].join("\n"),
      [`${dir}/field.ts`]: [
        'import type { FieldRenderer } from "@webforge/editor-ui";',
        `import { ${pascal}Field } from "./${pascal}Field.js";`,
        "",
        `/** The Edit panel's ${label.toLowerCase()} fields. */`,
        `export const ${kind}Field = (): FieldRenderer<"${kind}"> => ${pascal}Field;`,
        "",
      ].join("\n"),
      [`${dir}/${pascal}Field.stories.tsx`]: [
        'import type { Meta, StoryObj } from "@storybook/react-vite";',
        `import { ${pascal}Field } from "./${pascal}Field.js";`,
        "",
        `// The Edit panel's ${label.toLowerCase()} field.`,
        "",
        "const meta = {",
        `  title: "${story}",`,
        `  component: ${pascal}Field,`,
        "  args: {",
        `    id: "field-${kind}",`,
        `    labelId: "field-${kind}-label",`,
        `    field: { kind: "${kind}", label: "${label}" },`,
        "    value: undefined,",
        "    onChange: () => undefined,",
        "    onCommit: () => undefined,",
        "  },",
        "  // As in the Edit panel: its label above, in the right column's width.",
        "  render: (args) => (",
        '    <div className="flex w-60 flex-col gap-1 border border-border-strong bg-panel p-2">',
        `      <span id="field-${kind}-label" className="text-xs text-muted-foreground">`,
        `        ${label}`,
        "      </span>",
        `      <${pascal}Field {...args} />`,
        "    </div>",
        "  ),",
        `} satisfies Meta<typeof ${pascal}Field>;`,
        "",
        "export default meta;",
        "type Story = StoryObj<typeof meta>;",
        "",
        "/** Nothing set yet. */",
        "export const Empty: Story = {};",
        "",
        "/** Filled in. */",
        `export const Filled: Story = { args: { value: "${label}" } };`,
        "",
      ].join("\n"),
      [`${dir}/${pascal}Field.test.tsx`]: [
        "// @vitest-environment happy-dom",
        'import { cleanup, fireEvent, render, screen } from "@testing-library/react";',
        'import { afterEach, describe, expect, it, vi } from "vitest";',
        `import { ${pascal}Field } from "./${pascal}Field.js";`,
        "",
        "afterEach(cleanup);",
        "",
        `describe("${pascal}Field", () => {`,
        '  it("reports what is typed, and that the person is done", () => {',
        "    const onChange = vi.fn();",
        "    const onCommit = vi.fn();",
        "    render(",
        "      <>",
        `        <span id="label">${label}</span>`,
        `        <${pascal}Field`,
        `          id="field"`,
        `          labelId="label"`,
        `          field={{ kind: "${kind}", label: "${label}" }}`,
        "          value={undefined}",
        "          onChange={onChange}",
        "          onCommit={onCommit}",
        "        />",
        "      </>,",
        "    );",
        "",
        `    const box = screen.getByRole("textbox", { name: "${label}" });`,
        '    fireEvent.change(box, { target: { value: "new" } });',
        "    fireEvent.blur(box);",
        "",
        '    expect(onChange).toHaveBeenCalledWith("new");',
        "    expect(onCommit).toHaveBeenCalledOnce();",
        "  });",
        "});",
        "",
      ].join("\n"),
    },
    edits: {
      // 1. What it is, stores and gives render (a string, until it's something else).
      [schema]: [
        (text) =>
          insertAfter(
            text,
            '  | { readonly kind: "link"; readonly label: string }\n',
            `  /** ${label}: say what it stores. */\n  | { readonly kind: "${kind}"; readonly label: string }\n`,
          ),
        (text) =>
          insertBefore(
            text,
            ': Field extends { readonly kind: "list" }',
            `: Field extends { readonly kind: "${kind}" }\n ? string\n `,
          ),
      ],
      // 1. And what it may hold (#667): a string, like a text field.
      "packages/site-components/src/field-values.ts": [
        (text) => insertBefore(text, '        | "code";\n', `        | "${kind}"\n`),
        (text) =>
          insertBefore(
            text,
            '      case "icon":\n        return z.string().max(MAX_TEXT_LENGTH);',
            `      case "${kind}":\n`,
          ),
      ],
      // 2. How render reads it.
      "packages/site-components/src/define.ts": [
        (text) =>
          insertBefore(
            text,
            '      case "link": {',
            `      case "${kind}":\n        return typeof value === "string" ? value : typeof fallback === "string" ? fallback : "";\n`,
          ),
      ],
      // 3. Its Puck field: one the Edit panel edits.
      "packages/engine/src/puck/config.tsx": [
        (text) => insertAfter(text, '    case "media":\n', `    case "${kind}":\n`),
      ],
      "packages/engine/src/puck/config.test.tsx": [
        (text) =>
          insertBefore(
            text,
            '      list: { kind: "list"',
            `      ${kind}: { kind: "${kind}", label: "${label}" },\n`,
          ),
      ],
      // 4. What its renderer needs.
      "packages/editor-ui/src/components/edit/field-spec.ts": [
        (text) =>
          insertBefore(
            text,
            "\n};",
            `\n  /** Drawn by the app: ${label.toLowerCase()} (fields/${kind}/). */\n  readonly ${kind}: Nothing;`,
            text.indexOf("type FieldSpecs = {"),
          ),
      ],
      // 5. Its renderer, listed.
      [`${FIELDS}/field-renderers.ts`]: [
        (text) => addImport(text, `./${kind}/field.js`, `${kind}Field`),
        (text) =>
          insertBefore(
            text,
            "  };\n}",
            `    ${kind}: ${kind}Field(),\n`,
            text.indexOf("export function fieldRenderers"),
          ),
      ],
      // 6. The Edit panel's spec for it.
      [`${RENDERER}/editor/edit-panel-fields.ts`]: [
        (text) =>
          insertBefore(
            text,
            '    case "list":\n    case "richtext":\n    case "slot":\n      return undefined;',
            `    case "${kind}":\n      return { kind: "${kind}", label };\n`,
          ),
      ],
      // 7. The kind in the list, with its story.
      [`${FIELDS}/field-kinds.ts`]: [
        (text) =>
          insertBefore(
            text,
            '  list: { editPanel: "list"',
            `  ${kind}: { editPanel: "${kind}", story: "${story}" },\n`,
          ),
      ],
    },
    next: [
      `The "${kind}" kind stores a string and is drawn as a text box. Make it what it should be:`,
      "what it stores (schema.ts's StoredOne, define.ts's valueReader, field-values.ts's fieldValueSchema),",
      `what its renderer needs (field-spec.ts) and how it draws (${dir}/${pascal}Field.tsx).`,
    ],
  };
}

/** `pnpm scaffold ipc-domain`: an IPC domain with one call, from the contract to main's handler. */
export function ipcDomainPlanFor(root: string, names: Names): Plan {
  const { pascal, camel: domain } = names;
  if (domain !== names.file)
    throw new Error(`An IPC domain's name is one word (Calendar), not ${pascal}`);
  const shared = "apps/desktop/src/shared";
  const contract = `${shared}/ipc/${domain}.ts`;
  if (existsSync(join(root, contract)))
    throw new Error(`${contract} exists already: pick another name`);
  const call = `${domain}Status`;
  const handlers = `register${pascal}Handlers`;
  return {
    files: {
      [contract]: [
        'import { z } from "zod";',
        "",
        `/** Whether the ${domain} domain is ready: say what the renderer asks the main process for. */`,
        "const statusSchema = z.strictObject({ ready: z.boolean() });",
        "",
        `/** See {@link ${domain}Channels}' \`${call}\`. */`,
        `type ${pascal}Status = z.infer<typeof statusSchema>;`,
        "",
        `/** IPC channels of the \`${domain}\` domain (\`${domain}:*\`). Each one's arguments are checked. */`,
        `export const ${domain}Channels = {`,
        "  /** Whether it is ready. */",
        `  ${call}: {`,
        `    channel: "${domain}:status",`,
        "    request: z.tuple([]),",
        "    response: statusSchema,",
        "  },",
        "} as const;",
        "",
        `/** \`window.webforge.${domain}\`. */`,
        `export interface ${pascal}Api {`,
        "  /** Whether it is ready. */",
        `  status(): Promise<${pascal}Status>;`,
        "}",
        "",
      ].join("\n"),
      [`apps/desktop/src/preload/api/${domain}.ts`]: [
        `import type { ${pascal}Api } from "../../shared/ipc/${domain}.js";`,
        'import type { Call } from "./call.js";',
        "",
        `/** \`window.webforge.${domain}\`. */`,
        `export const ${domain}Api = (call: Call): ${pascal}Api => ({`,
        `  status: () => call("${call}"),`,
        "});",
        "",
      ].join("\n"),
      [`apps/desktop/src/main/${domain}-ipc.ts`]: [
        'import type { IpcMain } from "electron";',
        'import { registerIpcHandler } from "./ipc.js";',
        "",
        `/** Registers the \`${domain}\` IPC calls: say what the main process does for them. */`,
        `export function ${handlers}(`,
        '  ipc: Pick<IpcMain, "handle">,',
        "  isTrustedSender: (senderUrl: string) => boolean,",
        "): void {",
        `  registerIpcHandler(ipc, "${call}", isTrustedSender, () => ({ ready: true }));`,
        "}",
        "",
      ].join("\n"),
      [`apps/desktop/src/main/${domain}-ipc.test.ts`]: [
        'import type { IpcMain, IpcMainInvokeEvent } from "electron";',
        'import { describe, expect, it } from "vitest";',
        `import { ${handlers} } from "./${domain}-ipc.js";`,
        "",
        "type Handler = (event: IpcMainInvokeEvent, ...args: unknown[]) => Promise<unknown>;",
        "",
        "/** The handler of `channel`, called as from a renderer that `trusted` says it trusts or not. */",
        "function invoker(channel: string, trusted = true) {",
        "  const registered = new Map<string, Handler>();",
        "  const ipc = {",
        "    handle: (name: string, handler: Handler) => registered.set(name, handler),",
        '  } as unknown as Pick<IpcMain, "handle">;',
        `  ${handlers}(ipc, () => trusted);`,
        "  return (...args: unknown[]) =>",
        '    registered.get(channel)?.({ senderFrame: { url: "app" } } as IpcMainInvokeEvent, ...args);',
        "}",
        "",
        `describe("${handlers}", () => {`,
        '  it("says it is ready", async () => {',
        `    expect(await invoker("${domain}:status")()).toEqual({ ready: true });`,
        "  });",
        "",
        '  it("refuses a renderer it does not trust", async () => {',
        `    await expect(invoker("${domain}:status", false)()).rejects.toThrow();`,
        "  });",
        "});",
        "",
      ].join("\n"),
    },
    edits: {
      [`${shared}/ipc-contract.ts`]: [
        (text) => addImport(text, `./ipc/${domain}.js`, `${domain}Channels`),
        (text) =>
          addEntry(text, "export const ipcContract = {", "} as const;", `...${domain}Channels,`),
        (text) =>
          addEntry(
            text,
            "export const ipcDomains = {",
            "} as const;",
            `${domain}: ${domain}Channels,`,
          ),
      ],
      [`${shared}/webforge-api.ts`]: [
        (text) => addImport(text, `./ipc/${domain}.js`, `${pascal}Api`, true),
        (text) =>
          addEntry(
            text,
            "export interface WebforgeApi {",
            "\n}",
            `readonly ${domain}: ${pascal}Api;`,
          ),
      ],
      "apps/desktop/src/preload/api.ts": [
        (text) => addImport(text, `./api/${domain}.js`, `${domain}Api`),
        (text) =>
          insertBefore(
            text,
            "  };\n}",
            `    ${domain}: ${domain}Api(call),\n`,
            text.indexOf("export function createWebforgeApi"),
          ),
      ],
      "apps/desktop/src/main/app.ts": [
        (text) => addImport(text, `./${domain}-ipc.js`, handlers),
        (text) =>
          insertBefore(
            text,
            "    // A site double-clicked in Explorer arrives",
            `    ${handlers}(ipcMain, isTrustedSender);\n`,
          ),
      ],
    },
    next: [
      `Fill in ${contract} (the calls and their zod schemas), then main's handler and the preload's`,
      `${domain}Api. The renderer calls it as window.webforge.${domain}.`,
    ],
  };
}

/** Refuses string keys the English strings define already. */
function refuseKeys(root: string, keys: readonly string[]): void {
  const defined = stringKeys(root);
  const taken = keys.filter((key) => defined.has(key));
  if (taken.length > 0)
    throw new Error(`The strings have ${taken.join(", ")} already: pick another name`);
}

/** Two plans' edits together, each file's in order. */
function merge(
  a: Readonly<Record<string, readonly ((text: string) => string)[]>>,
  b: Readonly<Record<string, readonly ((text: string) => string)[]>>,
): Record<string, readonly ((text: string) => string)[]> {
  const merged: Record<string, readonly ((text: string) => string)[]> = { ...a };
  for (const [path, edits] of Object.entries(b)) merged[path] = [...(merged[path] ?? []), ...edits];
  return merged;
}

/** The plan for scaffolding `what` called `name` in the repository at `root`. */
export function planFor(
  what: What,
  name: string,
  { root = ".", folder, scope = "editor" }: { root?: string; folder?: string; scope?: Scope } = {},
): Plan {
  const names = namesOf(name);
  if (typeof names === "string") throw new Error(names);
  // Without --area, the name's own folder: `panel Notes` makes the notes area.
  const area = () => {
    const chosen = folder ?? names.file;
    const problem = folderProblem(chosen);
    if (problem !== undefined) throw new Error(problem);
    return chosen;
  };
  switch (what) {
    case "area":
      return areaPlanFor(root, names, scope);
    case "panel":
      return panelPlanFor(root, names, area(), scope);
    case "commands":
      return commandsPlanFor(root, names, area(), scope);
    case "field-kind":
      return fieldKindPlanFor(root, names);
    case "ipc-domain":
      return ipcDomainPlanFor(root, names);
  }
}

/** What {@link scaffold} did: the files it wrote or changed, and whether Biome formatted them. */
export type ScaffoldResult = {
  readonly written: string[];
  readonly changed: string[];
  readonly formatted: boolean;
  readonly next: readonly string[];
};

/** Formats `files` in the repository at `root` with Biome; false if it couldn't. */
function formatWithBiome(files: readonly string[], root: string): boolean {
  const biome = spawnSync("pnpm", ["exec", "biome", "check", "--write", ...files], {
    cwd: root,
    stdio: "ignore",
    shell: true,
  });
  return biome.status === 0;
}

/**
 * Carries out `plan` in the repository at `root`, then formats what it wrote and changed as the
 * repository formats its files (`format`, Biome unless given; `false` not at all). Everything is
 * worked out before anything is written, so a refusal leaves nothing behind.
 */
export function scaffold(
  plan: Plan,
  root = ".",
  format: ((files: readonly string[], root: string) => boolean) | false = formatWithBiome,
): ScaffoldResult {
  for (const path of Object.keys(plan.files)) {
    if (existsSync(join(root, path))) throw new Error(`${path} exists already: pick another name`);
  }
  const changed = applyEdits(plan, root);
  const files = { ...plan.files, ...changed };
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  const all = Object.keys(files);
  return {
    written: Object.keys(plan.files),
    changed: Object.keys(changed).filter((path) => !(path in plan.files)),
    formatted: format !== false && format(all, root),
    next: plan.next,
  };
}

/**
 * The files `plan` changes in the repository at `root`, as they would be: nothing is written. Throws,
 * naming the file, when an edit can't find its place.
 */
export function applyEdits(plan: Plan, root = "."): Record<string, string> {
  const changed: Record<string, string> = {};
  for (const [path, edits] of Object.entries(plan.edits)) {
    let text = plan.files[path] ?? readFileSync(join(root, path), "utf8");
    for (const edit of edits) {
      try {
        text = edit(text);
      } catch (error) {
        throw new Error(`${path}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    changed[path] = text;
  }
  return changed;
}

/** `--name`'s value in `args`, if there is one. */
const option = (args: readonly string[], name: string) => {
  const at = args.indexOf(name);
  return at === -1 ? undefined : args[at + 1];
};

const USAGE = [
  "Usage:",
  "  pnpm scaffold area <Name> [--window]",
  "  pnpm scaffold panel <Name> [--area <folder>] [--window]",
  "  pnpm scaffold commands <Name> [--area <folder>] [--window]",
  "  pnpm scaffold field-kind <Name>",
  "  pnpm scaffold ipc-domain <Name>",
  "",
].join("\n");

/** The command: scaffolds what `args` say, setting the exit code when it fails. */
export function main(
  args: readonly string[] = process.argv.slice(2),
  {
    root = ".",
    format = formatWithBiome,
  }: {
    readonly root?: string;
    readonly format?: ((files: readonly string[], root: string) => boolean) | false;
  } = {},
): void {
  const [what, name] = args;
  if (!WHATS.includes(what as What) || name === undefined || name.startsWith("--")) {
    process.stderr.write(USAGE);
    process.exitCode = 1;
    return;
  }
  try {
    const folder = option(args, "--area");
    const plan = planFor(what as What, name, {
      root,
      ...(folder === undefined ? {} : { folder }),
      scope: args.includes("--window") ? "window" : "editor",
    });
    const result = scaffold(plan, root, format);
    for (const path of result.written) process.stdout.write(`wrote ${path}\n`);
    for (const path of result.changed) process.stdout.write(`changed ${path}\n`);
    process.stdout.write(`Next: ${result.next.join(" ")} Then pnpm check.\n`);
    if (!result.formatted) {
      process.stderr.write("formatting failed: run pnpm format\n");
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
