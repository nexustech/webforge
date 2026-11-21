import { readFileSync } from "node:fs";
import { dirname, join, normalize } from "node:path";
import { expect, test } from "@playwright/test";
import { desktopDir } from "./launch.js";

// What the main process loads before it can make a window (#892, architecture §10's cold start):
// the built entry and every chunk it imports statically, which all load and compile before main's
// first line runs. The export's tools run in the export worker, and publishing's, the MCP server's
// and Site Check's load when first used (`import()`). One static import from a package's index can
// bring them all back (5 MB, 1.1–2 s of every start-up), so this fails before that ships.

/**
 * The most main's static graph may weigh: 1.42 MB when this was written, after #892 (6.2 MB
 * before). Raise it for something main needs at start-up, never for something it could load later.
 * 1.51 MB with the assistant's IPC contract (6.9a), whose schemas check every call to the handlers
 * main registers as it starts. 1.57 MB once the site components' words left main's catalogue
 * (#1150), with 2% to spare. 1.60 MB with a button's missing link (#1256): Site Check's words for
 * it, in the English strings main holds from the start for `t()`, and the model's `hasLink`, in
 * the model's chunk main loads at start; again with 2% to spare.
 */
const BUDGET_BYTES = 1_635_000;

/** Packages only the export worker, a publish, the MCP server or Site Check needs. */
const NOT_AT_START = [
  "react",
  "react-dom",
  "terser",
  "tailwindcss",
  "clean-css",
  "lucide-static",
  "js-beautify",
  "postcss",
  "html-minifier-terser",
  "sanitize-html",
  "@jsquash/jpeg",
  "@jsquash/png",
  "@jsquash/webp",
  "basic-ftp",
  "ssh2",
  "@modelcontextprotocol/sdk",
] as const;

/**
 * A key of the site components' own strings (`@webforge/i18n/components`): their fields' words,
 * there and nowhere else, which main never shows, so its start-up never loads them (#1150).
 */
const COMPONENT_STRING = /"field\.[\w.-]+"/;

/** A static import's target, relative (a chunk) or bare (a package), at the start of a line. */
const STATIC_IMPORT = /^import\s(?:[^;]*?\sfrom\s*)?"([^"]+)"/gm;

/** The package a module of the bundle came from, by its `// …/node_modules/<package>/…` comment. */
const BUNDLED_MODULE = /^\/\/ .*node_modules\/((?:@[^/\s]+\/)?[^/\s]+)\//gm;

type StaticGraph = {
  /** The bytes of every file loaded, by its path in `out/main`. */
  readonly files: ReadonlyMap<string, number>;
  /** Every package bundled into those files, or imported from `node_modules` by them. */
  readonly packages: ReadonlySet<string>;
  /** The first of the site components' own strings in those files, if any. */
  readonly componentString: string | undefined;
};

/** `out/main/index.js` and every file it imports statically, with the packages in them. */
function staticGraph(): StaticGraph {
  const root = join(desktopDir, "out/main");
  const files = new Map<string, number>();
  const packages = new Set<string>();
  let componentString: string | undefined;
  const waiting = ["index.js"];
  for (let file = waiting.pop(); file !== undefined; file = waiting.pop()) {
    if (files.has(file)) continue;
    const code = readFileSync(join(root, file), "utf8");
    files.set(file, Buffer.byteLength(code));
    componentString ??= COMPONENT_STRING.exec(code)?.[0];
    for (const [, target = ""] of code.matchAll(STATIC_IMPORT)) {
      if (target.startsWith(".")) waiting.push(normalize(join(dirname(file), target)));
      else if (!target.startsWith("node:")) packages.add(packageOf(target));
    }
    for (const [, name = ""] of code.matchAll(BUNDLED_MODULE)) packages.add(name);
  }
  return { files, packages, componentString };
}

/** The package `specifier` names: `ssh2`, `@modelcontextprotocol/sdk`. */
function packageOf(specifier: string): string {
  const parts = specifier.split("/");
  return (specifier.startsWith("@") ? parts.slice(0, 2) : parts.slice(0, 1)).join("/");
}

test("main's start-up loads none of the export's tools, within its budget (#892)", () => {
  const { files, packages, componentString } = staticGraph();
  const bytes = [...files.values()].reduce((sum, size) => sum + size, 0);
  console.log(`Main's static graph: ${files.size} files, ${bytes} bytes`);

  expect(NOT_AT_START.filter((name) => packages.has(name))).toEqual([]);
  expect(componentString, "the site components' strings, at main's start-up").toBeUndefined();
  expect(bytes).toBeLessThanOrEqual(BUDGET_BYTES);
});
