import { Window } from "happy-dom";
import { afterEach, describe, expect, it } from "vitest";
import { EDITOR_RENDER_CONTEXT } from "../library.js";
import { renderNodesToHtml } from "../render-static.js";
import { siteLibrary } from "./index.js";

const windows: Window[] = [];
afterEach(async () => {
  for (const happy of windows.splice(0)) await happy.happyDOM.close();
});

/** The cards section `type` draws with its defaults in `variant`, by their classes. */
function cards(type: string, variant: string): string[] {
  const defaults = siteLibrary.components[type]?.defaults ?? {};
  const happy = new Window();
  windows.push(happy);
  happy.document.body.innerHTML = renderNodesToHtml(
    [{ type, props: { id: "s", ...defaults, variant } }],
    siteLibrary,
    EDITOR_RENDER_CONTEXT,
  );
  return [...happy.document.querySelectorAll(".wf-card")].map((card) => card.className);
}

describe("cards (2.13d)", () => {
  it.each(["Features", "Stats", "Team", "Testimonials"])(
    "marks %s's cards, flat on the second surface, for the theme's card style",
    (type) => {
      const marked = cards(type, "cards");

      expect(marked.length).toBeGreaterThan(0);
      for (const classes of marked) expect(classes).toContain("bg-base-200");
    },
  );

  it("marks nothing in layouts without cards", () => {
    expect(cards("Features", "centred")).toEqual([]);
    expect(cards("Stats", "split")).toEqual([]);
    expect(cards("Team", "round")).toEqual([]);
    expect(cards("Testimonials", "large")).toEqual([]);
  });
});
