import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { TEST_DIR_REMOVAL } from "@webforge/test-utils/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  businessTypesIn,
  inNewSiteOrder,
  templateIndexModule,
  templatesIn,
} from "./build-template-index.js";
import { main, newTemplate } from "./new-template.js";

// `pnpm new-template` and `pnpm template-index` (#983), in a copy of the files they read and write.

const ROOT = join(import.meta.dirname, "..", "..");

/** The files the scaffold reads and writes, copied to a repository of their own. */
const FILES = [
  "packages/templates/templates/blank/template.json",
  "packages/templates/templates/blank/images.json",
  "packages/templates/templates/blank/thumbnail.png",
  "packages/templates/templates/cafe/template.json",
  "packages/model/src/settings.ts",
  "packages/i18n/src/en/templates.ts",
  "docs/help/templates.md",
];

let made: string | undefined;
afterEach(() => {
  if (made !== undefined) rmSync(made, TEST_DIR_REMOVAL);
  made = undefined;
  process.exitCode = undefined;
  vi.restoreAllMocks();
});

/** A repository holding {@link FILES}, as this one has them. */
function repository(): string {
  made = mkdtempSync(join(tmpdir(), "new-template-"));
  for (const file of FILES) {
    mkdirSync(join(made, dirname(file)), { recursive: true });
    cpSync(join(ROOT, file), join(made, file));
  }
  return made;
}

const read = (root: string, file: string) => readFileSync(join(root, file), "utf8");

describe("new-template (#983)", () => {
  it("writes the template from Blank's folder, its strings and its help page's row", () => {
    const root = repository();
    const result = newTemplate("photo-studio", "creative", root, {
      finish: false,
      today: "2026-11-15",
    });

    const folder = "packages/templates/templates/photo-studio";
    expect(result).toEqual({
      written: [
        `${folder}/template.json`,
        `${folder}/images.json`,
        `${folder}/thumbnail.png`,
        "packages/i18n/src/en/templates.ts",
        "docs/help/templates.md",
      ],
      finished: false,
    });
    const template = JSON.parse(read(root, `${folder}/template.json`));
    const blank = JSON.parse(read(root, "packages/templates/templates/blank/template.json"));
    expect(template).toEqual({
      ...blank,
      id: "photo-studio",
      category: "creative",
      example: false,
    });
    expect(read(root, `${folder}/images.json`)).toBe("[]\n");
    expect(existsSync(join(root, `${folder}/thumbnail.png`))).toBe(true);
    // Its strings come before Blank's, the last of the templates'.
    const strings = read(root, "packages/i18n/src/en/templates.ts");
    expect(strings.indexOf('"template.photo-studio.name": "Photo studio"')).toBeGreaterThan(0);
    expect(strings.indexOf('"template.photo-studio.description":')).toBeLessThan(
      strings.indexOf('"template.blank.name"'),
    );
    // A row before Blank's, as wide as it, with the type's name; the page updated (HP-4).
    const help = read(root, "docs/help/templates.md");
    const rows = help.split("\n").filter((line) => line.startsWith("| "));
    const at = rows.findIndex((row) => row.startsWith("| Photo studio"));
    expect(rows[at]).toContain("| Creative ");
    expect(rows[at + 1]).toMatch(/^\| Blank site/);
    expect(rows[at]?.length).toBe(rows[at + 1]?.length);
    expect(help).toContain("updated: 2026-11-15");
  });

  it("refuses an id or type it can't use, and writes nothing", () => {
    const root = repository();
    const before = read(root, "packages/i18n/src/en/templates.ts");
    const write = (id: string, type: string) => () =>
      newTemplate(id, type, root, { finish: false, today: "2026-11-15" });

    expect(write("Photo Studio", "creative")).toThrow(/lower case words/);
    expect(write("blank", "creative")).toThrow(/exists already/);
    expect(write("cafe", "food")).toThrow(/exists already/);
    expect(write("photo-studio", "plumbing")).toThrow(/--type must be a business type: food,/);
    expect(read(root, "packages/i18n/src/en/templates.ts")).toBe(before);
    expect(existsSync(join(root, "packages/templates/templates/photo-studio"))).toBe(false);
  });

  it("says how it's used, and what's next once it has written the template", () => {
    const root = repository();
    const errors = vi.spyOn(process.stderr, "write").mockReturnValue(true);
    const output = vi.spyOn(process.stdout, "write").mockReturnValue(true);

    main(["tea-room"], { root });
    expect(process.exitCode).toBe(1);
    expect(errors).toHaveBeenCalledWith(expect.stringContaining("Usage: pnpm new-template"));

    process.exitCode = undefined;
    main(["tea-room", "--type", "food"], { root, steps: { finish: () => true } });
    expect(process.exitCode).toBeUndefined();
    const printed = output.mock.calls.map(([text]) => String(text)).join("");
    expect(printed).toContain("wrote packages/templates/templates/tea-room/template.json");
    expect(printed).toContain("pnpm template-thumbnails, which needs Docker");
  });
});

describe("template-index (#983)", () => {
  it("lists the templates by business type, then those without one, by id within each", () => {
    const types = businessTypesIn(ROOT);
    expect(types.slice(0, 2)).toEqual(["food", "beauty"]);
    const ordered = inNewSiteOrder(
      [
        { id: "blank", category: null },
        { id: "zoo", category: "food" },
        { id: "salon", category: "beauty" },
        { id: "cafe", category: "food" },
      ],
      types,
    );
    expect(ordered.map(({ id }) => id)).toEqual(["cafe", "zoo", "salon", "blank"]);
  });

  it("imports each manifest by a name it can have: a hyphenated id, a reserved word", () => {
    const module = templateIndexModule([
      { id: "photo-studio", category: "creative" },
      { id: "case", category: "trades" },
      { id: "blank", category: null },
    ]);
    expect(module).toContain(
      'import photoStudioImages from "../templates/photo-studio/images.json" with { type: "json" };',
    );
    expect(module).toContain('import caseImages from "../templates/case/images.json" with');
    expect(module).not.toMatch(/^import case /m);
    expect(module).toContain('  "photo-studio": photoStudioImages,');
    expect(module).toContain('  "case": caseImages,');
    expect(module).toContain(
      ["export const TEMPLATE_IDS = [", '  "photo-studio",', '  "case",', '  "blank",', "]"].join(
        "\n",
      ),
    );
  });

  it("reads each folder's template, and refuses one whose id isn't its folder's", () => {
    const root = repository();
    expect(templatesIn(root)).toEqual([
      { id: "blank", category: null },
      { id: "cafe", category: "food" },
    ]);
    cpSync(
      join(root, "packages/templates/templates/cafe"),
      join(root, "packages/templates/templates/bistro"),
      { recursive: true },
    );
    expect(() => templatesIn(root)).toThrow(/bistro\/template.json has the id cafe/);
  });
});

describe("new-template's business types (#983)", () => {
  it("fails plainly when the model's list isn't where it reads it", () => {
    const root = repository();
    writeFileSync(join(root, "packages/model/src/settings.ts"), "export const TYPES = [];\n");
    expect(() =>
      newTemplate("tea-room", "food", root, { finish: false, today: "2026-11-15" }),
    ).toThrow(/No BUSINESS_TYPES in packages\/model\/src\/settings.ts/);
  });
});
