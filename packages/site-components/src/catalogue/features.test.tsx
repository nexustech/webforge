import { t } from "@webforge/i18n/components";
import { Window } from "happy-dom";
import { afterEach, describe, expect, it } from "vitest";
import { CARD_ROWS } from "../card-rows.js";
import { EDITOR_RENDER_CONTEXT } from "../library.js";
import { renderNodesToHtml } from "../render-static.js";
import { siteLibrary } from "./index.js";

const defaults = siteLibrary.components.Features?.defaults ?? {};

/** The Features section with `props` over its defaults, as the export renders it. */
const render = (props: Record<string, unknown> = {}) =>
  renderNodesToHtml(
    [{ type: "Features", props: { id: "features", ...defaults, ...props } }],
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

describe("the Features section", () => {
  it("renders with its starter text and three features, as the Add panel places it", () => {
    const doc = page(render());

    expect(doc.querySelector(".site-features h2")?.textContent).toBe(t("starter.featuresTitle"));
    expect(doc.body.textContent).toContain(t("starter.featuresText"));
    const items = doc.querySelectorAll(".site-feature");
    expect(items).toHaveLength(3);
    for (const item of items) {
      expect(item.querySelector("h3")?.textContent).toBe(t("starter.featureTitle"));
      expect(item.querySelector("svg")).not.toBeNull();
    }
  });

  it("lays its features out as cards, centred icons or a list", () => {
    const cards = page(render({ variant: "cards" }));
    const centred = page(render({ variant: "centred" }));
    const list = page(render({ variant: "list" }));

    expect(cards.querySelector(".site-feature")?.className).toContain("bg-base-200");
    // Rows of three that centre a last row not full (#1372), every card the same height (#1511).
    expect(cards.querySelector(".flex-wrap")?.className).toBe(CARD_ROWS.threeGap6EveryRow);
    expect(centred.querySelector(".site-feature")?.className).toContain("text-center");
    expect(centred.querySelector(".site-feature .rounded-full svg")).not.toBeNull();
    expect(list.querySelector(".site-feature")?.className).toContain("flex items-start");
    expect(list.querySelector(".flex-wrap")?.className).toBe(CARD_ROWS.twoGap8);
  });

  it("draws its cards the same height on every row unless Card height is Fit the text (#1511)", () => {
    const row = (props: Record<string, unknown>) =>
      page(render({ variant: "cards", ...props })).querySelector(".flex-wrap")?.className;

    // Saved before there was a setting: none, which reads as Same height.
    expect(row({ cardHeight: undefined })).toBe(CARD_ROWS.threeGap6EveryRow);
    expect(row({ cardHeight: "same" })).toBe(CARD_ROWS.threeGap6EveryRow);
    expect(row({ cardHeight: "fit" })).toBe(`${CARD_ROWS.threeGap6} items-start`);
    // The other layouts have no card box: their rows as before, whatever the setting says.
    expect(
      page(render({ variant: "centred", cardHeight: "fit" })).querySelector(".flex-wrap")
        ?.className,
    ).toBe(CARD_ROWS.threeGap10);
  });

  it("shows Card height for the cards layout only (#1511)", () => {
    const field = siteLibrary.components.Features?.fields.cardHeight;
    const site = { menuLinksToSections: false };

    expect(field?.shownWhen?.({ variant: "cards" }, site)).toBe(true);
    expect(field?.shownWhen?.({ variant: "centred" }, site)).toBe(false);
    expect(field?.shownWhen?.({ variant: "list" }, site)).toBe(false);
  });

  it("takes the first layout for one it doesn't have", () => {
    const doc = page(render({ variant: "carousel" }));

    expect(doc.querySelector(".site-feature")?.className).toContain("bg-base-200");
  });

  it("draws no icon for a feature without one", () => {
    const doc = page(
      render({
        items: [
          { type: "Feature", props: { id: "plain", title: "Fresh bread", text: "<p>Daily.</p>" } },
        ],
      }),
    );

    const item = doc.querySelector(".site-feature");
    expect(item?.querySelector("h3")?.textContent).toBe("Fresh bread");
    expect(item?.querySelector("svg")).toBeNull();
  });

  it("lifts every feature under the pointer when the section says so, and none unless it does", () => {
    const plain = page(render());
    const lifting = page(render({ hover: "lift" }));
    // An effect left on one feature (sites from before the section had it) does nothing.
    const leftOnItem = page(
      render({
        items: [{ type: "Feature", props: { id: "lift", title: "Fresh", hover: "lift" } }],
      }),
    );

    expect(plain.querySelector(".site-feature")?.className).not.toContain("hover:");
    const lifted = [...lifting.querySelectorAll(".site-feature")];
    expect(lifted).toHaveLength(3);
    for (const item of lifted) {
      expect(item.className).toContain("motion-safe:hover:-translate-y-1");
    }
    expect(leftOnItem.querySelector(".site-feature")?.className).not.toContain("hover:");
  });
});
