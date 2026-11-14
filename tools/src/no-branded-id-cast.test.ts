import { spawnSync } from "node:child_process";
import { copyFileSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";

const plugin = fileURLToPath(new URL("../biome/no-branded-id-cast.grit", import.meta.url));
const biome = fileURLToPath(
  new URL("../../node_modules/@biomejs/biome/bin/biome", import.meta.url),
);

/** Each probe: a cast, and whether the plugin refuses it. */
const PROBES: readonly (readonly [string, boolean])[] = [
  ["raw as PageId", true],
  ["raw as MediaId", true],
  ["raw as PageId | undefined", true],
  ["[raw] as readonly SharedSectionId[]", true],
  ["entries as [CollectionId, Page][]", true],
  ["record as Record<ThemeId, Page>", true],
  ["raw as keyof SiteDoc", true],
  ["raw as string", false],
  ["record as Record<string, Page>", false],
  ["raw as PageIdLike", false],
];

const folder = mkdtempSync(join(tmpdir(), "branded-id-cast-"));

afterAll(() => {
  rmSync(folder, { recursive: true, force: true });
});

/** The lines of `probe.ts` the plugin reports, linting it with only the plugin's config. */
function reportedLines(): number[] {
  copyFileSync(plugin, join(folder, "no-branded-id-cast.grit"));
  writeFileSync(
    join(folder, "biome.json"),
    JSON.stringify({ root: true, plugins: ["./no-branded-id-cast.grit"] }),
  );
  const lines = PROBES.map(([cast], index) => `export const probe${index} = ${cast};`);
  writeFileSync(join(folder, "probe.ts"), `${lines.join("\n")}\n`);
  const run = spawnSync(process.execPath, [biome, "lint", "--reporter=json", "probe.ts"], {
    cwd: folder,
    encoding: "utf8",
  });
  const report = JSON.parse(run.stdout) as {
    diagnostics: { category: string; location: { start: { line: number } } }[];
  };
  return report.diagnostics
    .filter((diagnostic) => diagnostic.category === "plugin")
    .map((diagnostic) => diagnostic.location.start.line);
}

describe("the Biome plugin against casts to branded ids (R10, #989)", () => {
  it("refuses a cast whose type names one, in a union, an array, a tuple or a record too", () => {
    const refused = PROBES.flatMap(([, expected], index) => (expected ? [index + 1] : []));

    expect(reportedLines()).toEqual(refused);
  }, 30_000);
});
