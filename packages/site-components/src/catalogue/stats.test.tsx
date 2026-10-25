import { t } from "@webforge/i18n";
import { Window } from "happy-dom";
import { afterEach, describe, expect, it } from "vitest";
import { EDITOR_RENDER_CONTEXT } from "../library.js";
import { renderNodesToHtml } from "../render-static.js";
import { siteLibrary } from "./index.js";

const defaults = siteLibrary.components.Stats?.defaults ?? {};

/** The Stats section with `props` over its defaults, as the export renders it. */
const render = (props: Record<string, unknown> = {}) =>
  renderNodesToHtml(
    [{ type: "Stats", props: { id: "stats", ...defaults, ...props } }],
    siteLibrary,
    EDITOR_RENDER_CONTEXT,
  );

const windows: Window[] = [];
afterEach(async () => {
  for (const happy of windows.splice(0)) await happy.happyDOM.close();
});

/** A page of `html`, to query. */
function page(html: string) {
  const happy = new Window();
  windows.push(happy);
  happy.document.body.innerHTML = html;
  return happy.document;
}

/** A stat of `number` and `label`. */
const stat = (id: string, number: string, label: string) => ({
  type: "Stat",
  props: { id, number, label },
});

describe("the Stats section", () => {
  it("renders a title, an introduction and three stats, as the Add panel places it", () => {
    const doc = page(render());

    expect(doc.querySelector(".site-stats h2")?.textContent).toBe(t("starter.statsTitle"));
    expect(doc.querySelector(".site-stats")?.textContent).toContain(t("starter.statsText"));
    expect(
      [...doc.querySelectorAll(".site-stat")].map((each) =>
        [...each.children].map((part) => part.textContent),
      ),
    ).toEqual([
      [t("starter.statYears"), t("starter.statYearsLabel")],
      [t("starter.statCustomers"), t("starter.statCustomersLabel")],
      [t("starter.statRating"), t("starter.statRatingLabel")],
    ]);
  });

  it("shows each number as written, with nothing to count it up", () => {
    const doc = page(render({ items: [stat("one", "1,200+", "jobs done")] }));

    expect(doc.querySelector(".site-stat .text-4xl")?.textContent).toBe("1,200+");
    expect(doc.querySelector("[data-count], [data-behaviour]")).toBeNull();
  });

  it("lays its stats out in a row, as cards, or beside the title and introduction", () => {
    const items = [stat("one", "15", "years")];
    const row = page(render({ variant: "row", items }));
    const cards = page(render({ variant: "cards", items }));
    const split = page(render({ variant: "split", items }));

    expect(row.querySelector(".site-stat")?.className).toContain("text-center");
    expect(row.querySelector(".site-stat")?.className).not.toContain("bg-base-200");
    expect(cards.querySelector(".site-stat")?.className).toContain("bg-base-200");
    expect(split.querySelector(".site-stat")?.className).not.toContain("text-center");
    expect(split.querySelector(".site-stat")?.parentElement?.className).toContain("grid-cols-2");
    expect(split.querySelector("h2")?.closest(".md\\:grid-cols-2")).not.toBeNull();
  });
});
