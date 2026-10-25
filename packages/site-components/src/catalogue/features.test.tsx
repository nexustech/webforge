import { t } from "@webforge/i18n";
import { Window } from "happy-dom";
import { afterEach, describe, expect, it } from "vitest";
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
    expect(cards.querySelector(".grid")?.className).toContain("md:grid-cols-3");
    expect(centred.querySelector(".site-feature")?.className).toContain("text-center");
    expect(centred.querySelector(".site-feature .rounded-full svg")).not.toBeNull();
    expect(list.querySelector(".site-feature")?.className).toContain("flex items-start");
    expect(list.querySelector(".grid")?.className).toContain("md:grid-cols-2");
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
