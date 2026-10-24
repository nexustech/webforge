// Renderer area cycles (2.20, B2): no two areas of apps/desktop/src/renderer/ may depend on each
// other, directly or through others.
//
// Usage (part of the root "deps" script):
//   node tools/src/check-area-cycles.ts <renderer folder>
//
// An area is a folder under the renderer (`site/`, `menu/`); `shell/`, `editor/` and `testing/`
// are what every area builds on, not areas. dependency-cruiser keeps each area to the others'
// index.ts (rule "renderer-areas-through-index"); its own cycle check sees modules, and two areas
// can depend on each other without a module cycle, so this checks the areas as a graph. Tests and
// stories are left out: one may bring two areas together to test them.
//
// This file has no relative imports so Node can run it directly with type stripping.

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** Folders every area builds on (`testing/`: for its tests and stories), rather than areas. */
const BASE = new Set(["shell", "editor", "testing"]);

/** An import of another area: `from "../menu/index.js"`. */
const AREA_IMPORT = /from\s+["']\.\.\/([\w-]+)\//g;

/** The areas each area imports, from the text of its files (`areas`: each area's sources). */
export function areaGraph(areas: ReadonlyMap<string, readonly string[]>): Map<string, Set<string>> {
  const graph = new Map<string, Set<string>>();
  for (const [area, sources] of areas) {
    const uses = new Set<string>();
    for (const source of sources) {
      for (const [, other] of source.matchAll(AREA_IMPORT)) {
        if (other !== undefined && other !== area && !BASE.has(other) && areas.has(other)) {
          uses.add(other);
        }
      }
    }
    graph.set(area, uses);
  }
  return graph;
}

/** Each cycle in `graph`, once, as the areas along it: `["menu", "site", "menu"]`. */
export function areaCycles(graph: ReadonlyMap<string, ReadonlySet<string>>): string[][] {
  const cycles: string[][] = [];
  const seen = new Set<string>();
  const done = new Set<string>();
  const visit = (area: string, path: string[]) => {
    if (done.has(area)) return;
    const at = path.indexOf(area);
    if (at >= 0) {
      const cycle = [...path.slice(at), area];
      const key = [...cycle.slice(0, -1)].sort().join(" ");
      if (!seen.has(key)) {
        seen.add(key);
        cycles.push(cycle);
      }
      return;
    }
    for (const next of [...(graph.get(area) ?? [])].sort()) visit(next, [...path, area]);
    if (path.length === 0) done.add(area);
  };
  for (const area of [...graph.keys()].sort()) visit(area, []);
  return cycles;
}

/** Every non-test source file under `folder`, as text. */
function sourcesIn(folder: string): string[] {
  return readdirSync(folder, { withFileTypes: true, recursive: true })
    .filter(
      (entry) =>
        entry.isFile() && /\.tsx?$/.test(entry.name) && !/\.(test|stories)\.tsx?$/.test(entry.name),
    )
    .map((entry) => readFileSync(join(entry.parentPath, entry.name), "utf8"));
}

/** The areas under `renderer` and the cycles between them, from their files on disk. */
export function areaCyclesIn(renderer: string): { areas: number; cycles: string[][] } {
  const areas = new Map(
    readdirSync(renderer, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && !BASE.has(entry.name))
      .map((entry) => [entry.name, sourcesIn(join(renderer, entry.name))] as const),
  );
  return { areas: areas.size, cycles: areaCycles(areaGraph(areas)) };
}

/** The command: checks the renderer folder in `args`, setting the exit code when it fails. */
export function main(args: readonly string[] = process.argv.slice(2)): void {
  const [renderer] = args;
  if (renderer === undefined) {
    console.error("Usage: node tools/src/check-area-cycles.ts <renderer folder>");
    process.exitCode = 2;
    return;
  }
  const { areas, cycles } = areaCyclesIn(renderer);
  if (cycles.length > 0) {
    console.error(
      [
        `Found ${cycles.length} cycle(s) between renderer areas (2.20, B2). Move what both need into editor/ or shell/:`,
        ...cycles.map((cycle) => `  ${cycle.join(" → ")}`),
      ].join("\n"),
    );
    process.exitCode = 1;
    return;
  }
  console.log(`No cycles between the ${areas} renderer areas.`);
}

if (import.meta.main) {
  main();
}
