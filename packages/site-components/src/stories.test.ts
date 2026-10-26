import { describe, expect, it } from "vitest";
import { siteLibrary } from "./catalogue/index.js";

// The stories' sources as Vite reads them: only here, in a test.
const STORIES = import.meta.glob("./**/*.stories.tsx", {
  query: "?raw",
  import: "default",
  eager: true,
});

/** The components a story names (`type: "Hero"`), or a story's helper does. */
function named(): Set<string> {
  const text = Object.values(STORIES).join("\n");
  return new Set(Object.keys(siteLibrary.components).filter((type) => text.includes(`"${type}"`)));
}

/** `types`, with the components their defaults place (a Features' Feature items). */
function withDefaults(types: ReadonlySet<string>): Set<string> {
  const shown = new Set(types);
  for (const type of types) {
    const defaults = JSON.stringify(siteLibrary.components[type]?.defaults ?? {});
    for (const [, placed = ""] of defaults.matchAll(/"type":"([A-Za-z]+)"/g)) shown.add(placed);
  }
  return shown;
}

describe("the site components' stories (2.16)", () => {
  it("show every component the catalogue has, so each has screenshots, axe and keyboard checks", () => {
    const shown = withDefaults(named());
    const missing = Object.keys(siteLibrary.components).filter((type) => !shown.has(type));
    expect(missing).toEqual([]);
  });
});
