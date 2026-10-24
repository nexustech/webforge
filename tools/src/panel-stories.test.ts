import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// Every panel the renderer registers has a story (2.20, B6): a story made with panelStory() that
// calls its register…Panel function, so Storybook's axe and screenshot checks see the panel as the
// app registers it.

const RENDERER = join(import.meta.dirname, "../../apps/desktop/src/renderer");

/** The renderer's source files, as path (from the renderer) and text. */
function files(): { path: string; text: string }[] {
  return readdirSync(RENDERER, { withFileTypes: true, recursive: true })
    .filter((entry) => entry.isFile() && /\.tsx?$/.test(entry.name))
    .map((entry) => {
      const full = join(entry.parentPath, entry.name);
      return {
        path: relative(RENDERER, full).split("\\").join("/"),
        text: readFileSync(full, "utf8"),
      };
    });
}

describe("panel stories (2.20, B6)", () => {
  const all = files();
  const sources = all.filter(({ path }) => !/\.(test|stories)\.tsx?$/.test(path));
  const stories = all.filter(({ path }) => path.endsWith(".stories.tsx"));
  const registrations = sources.flatMap(({ path, text }) =>
    [...text.matchAll(/export function (register\w*Panel)\b/g)].map(([, name]) => ({
      name: name ?? "",
      path,
    })),
  );

  it("finds the panels the renderer registers", () => {
    expect(registrations.map(({ name }) => name)).toContain("registerLayersPanel");
  });

  it("has a panelStory() story for every register…Panel", () => {
    const missing = registrations.filter(
      ({ name }) =>
        !stories.some(
          ({ text }) => text.includes("panelStory(") && new RegExp(`\\b${name}\\(`).test(text),
        ),
    );

    expect(
      missing.map(
        ({ name, path }) =>
          `${name} (${path}) has no story. Add one next to it: ` +
          `export const Panel: Story = panelStory((panels, session) => ${name}(panels, session)), ` +
          `importing panelStory from "../testing/stories.js" (see register-layers-panel.stories.tsx).`,
      ),
    ).toEqual([]);
  });
});
