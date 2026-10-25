import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Every Edit panel renderer that draws a kind of field has a story (2.20, B5): the title each kind
// lists in apps/desktop/src/renderer/fields/field-kinds.ts is a story's, so Storybook's axe and
// screenshot checks see the renderer.

const ROOT = join(import.meta.dirname, "../..");
const FIELD_KINDS = join(ROOT, "apps/desktop/src/renderer/fields/field-kinds.ts");
const STORIES = [join(ROOT, "packages/editor-ui/src"), join(ROOT, "apps/desktop/src/renderer")];

/** The titles of the stories under `folder`. */
function storyTitles(folder: string): string[] {
  return readdirSync(folder, { withFileTypes: true, recursive: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".stories.tsx"))
    .flatMap((entry) => {
      const text = readFileSync(join(entry.parentPath, entry.name), "utf8");
      return [...text.matchAll(/^\s+title: "([^"]+)",$/gm)].map(([, title]) => title ?? "");
    });
}

describe("field kinds' stories (2.20, B5)", () => {
  const source = readFileSync(FIELD_KINDS, "utf8");
  const listed = [...source.matchAll(/(\w+): \{ editPanel: "(\w+)", story: "([^"]+)" \}/g)].map(
    ([, kind = "", renderer = "", story = ""]) => ({ kind, renderer, story }),
  );
  const titles = new Set(STORIES.flatMap(storyTitles));

  it("reads every kind the Edit panel draws", () => {
    // One line each: a kind written over several lines would be missed.
    expect(listed).toHaveLength([...source.matchAll(/editPanel: "/g)].length);
    expect(listed.map(({ kind }) => kind)).toContain("text");
  });

  it("has a story for the renderer of every kind", () => {
    const missing = listed.filter(({ story }) => !titles.has(story));

    expect(
      missing.map(
        ({ kind, renderer, story }) =>
          `${kind} fields are drawn by the "${renderer}" renderer, whose story "${story}" ` +
          "(FIELD_KINDS in apps/desktop/src/renderer/fields/field-kinds.ts) doesn't exist. Add " +
          "a story with that title next to the renderer, as fields/link/LinkField.stories.tsx does.",
      ),
    ).toEqual([]);
  });
});
