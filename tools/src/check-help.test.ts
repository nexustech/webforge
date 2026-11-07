import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { appNameIn, checkHelp, HELP_PATHS } from "./check-help.js";

const made: string[] = [];
afterEach(() => {
  for (const dir of made.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/** A repository with `pages` in docs/help, a catalogue of `types` and `app.name` set. */
function repository(pages: Record<string, string>, types: string[] = []): string {
  const root = mkdtempSync(join(tmpdir(), "webforge-help-check-"));
  made.push(root);
  for (const folder of [HELP_PATHS.pages, HELP_PATHS.strings, "packages/site-components/src"]) {
    mkdirSync(join(root, folder), { recursive: true });
  }
  for (const [name, text] of Object.entries(pages)) {
    writeFileSync(join(root, HELP_PATHS.pages, name), text);
  }
  const components = Object.fromEntries(types.map((type) => [type, {}]));
  writeFileSync(join(root, HELP_PATHS.catalogue), JSON.stringify({ components }));
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
        "export.md": `${front("export", "components: [Hero]\n")}# Export\n\nSee [Publish](publish.md).`,
        "publish.md": `${front("publish")}# Publish\n\n{appName} sends it.`,
      },
      ["Hero"],
    );
    expect(checkHelp(root)).toEqual([]);
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

  it("reads the app's name from the string catalogue, or says it can't", () => {
    const root = repository({});
    expect(appNameIn(join(root, HELP_PATHS.strings))).toBe("Webforge");
    expect(() => appNameIn(join(root, HELP_PATHS.pages))).toThrow(/No "app.name"/);
  });
});
