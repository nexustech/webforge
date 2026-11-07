import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { appNameIn, checkHelp, HELP_PATHS, main } from "./check-help.js";

const made: string[] = [];
afterEach(() => {
  for (const dir of made.splice(0)) rmSync(dir, { recursive: true, force: true });
  vi.restoreAllMocks();
  process.exitCode = undefined;
});

/** A repository with `pages` in docs/help, a catalogue of `types` and `app.name` set. */
function repository(
  pages: Record<string, string>,
  types: string[] = [],
  links: Record<string, { page: string; anchor?: string }> = {},
): string {
  const root = mkdtempSync(join(tmpdir(), "webforge-help-check-"));
  made.push(root);
  for (const folder of [
    HELP_PATHS.pages,
    HELP_PATHS.strings,
    "packages/site-components/src",
    "apps/desktop/src/renderer/help",
  ]) {
    mkdirSync(join(root, folder), { recursive: true });
  }
  for (const [name, text] of Object.entries(pages)) {
    writeFileSync(join(root, HELP_PATHS.pages, name), text);
  }
  const components = Object.fromEntries(types.map((type) => [type, { label: type, fields: {} }]));
  writeFileSync(join(root, HELP_PATHS.catalogue), JSON.stringify({ components }));
  writeFileSync(join(root, HELP_PATHS.links), JSON.stringify(links));
  writeFileSync(
    join(root, HELP_PATHS.strings, "app.ts"),
    'export const app = { "app.name": "Webforge" };',
  );
  return root;
}

const front = (id: string, extra = "") =>
  `---\nid: ${id}\ntitle: T\nsummary: S.\nrelated: []\nupdated: 2026-11-07\n${extra}---\n\n`;

describe("check-help (5.4b, HP-5)", () => {
  it("passes good pages, and leaves the README out", () => {
    const root = repository(
      {
        "README.md": "# Help\n\nWebforge's help, with <b>HTML</b> allowed here.",
        "export.md": `${front("export", "components: [Hero]\n")}# Export\n\nSee [Publish](publish.md).\n\n## Hero`,
        "publish.md": `${front("publish")}# Publish\n\n{appName} sends it.`,
      },
      ["Hero"],
    );
    expect(checkHelp(root)).toEqual([]);
  });

  it("checks the app's ? links against the pages", () => {
    const root = repository({ "export.md": `${front("export")}# Export\n\n## Options` }, [], {
      export: { page: "export" },
      options: { page: "export", anchor: "options" },
      gone: { page: "export", anchor: "gone" },
    });
    expect(checkHelp(root)).toEqual(["? links: no heading export#gone"]);
  });

  it("finds what's wrong in the pages, against the catalogue and the app's name", () => {
    const root = repository(
      { "export.md": `${front("export")}# Export\n\nWebforge sends it to [Publish](publish.md).` },
      ["Hero"],
    );
    expect(checkHelp(root)).toEqual([
      "export.md: spells out Webforge; write {appName}",
      "export.md: links to a page that isn't there: publish.md",
      "components: Hero is on no page",
    ]);
  });

  it("says the pages are in order, or lists each problem and fails", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    main(repository({ "export.md": `${front("export")}# Export` }));
    expect(log).toHaveBeenCalledWith("The help pages in docs/help are all in order.");
    expect(process.exitCode).toBeUndefined();

    main(repository({ "export.md": `${front("export")}# Export\n\n[Gone](gone.md)` }));
    expect(error).toHaveBeenCalledWith("  export.md: links to a page that isn't there: gone.md");
    expect(process.exitCode).toBe(1);
  });

  it("reads the app's name from the string catalogue, or says it can't", () => {
    const root = repository({});
    const strings = join(root, HELP_PATHS.strings);
    // Tests and other files in the folder aren't read for it.
    writeFileSync(join(strings, "a.test.ts"), 'const x = { "app.name": "Testforge" };');
    writeFileSync(join(strings, "README.md"), '"app.name": "Readforge"');
    expect(appNameIn(strings)).toBe("Webforge");
    expect(() => appNameIn(join(root, HELP_PATHS.pages))).toThrow(/No "app.name"/);
  });
});
