import { Window } from "happy-dom";
import { afterEach, describe, expect, it } from "vitest";
import { EDITOR_RENDER_CONTEXT } from "../library.js";
import { renderNodesToHtml } from "../render-static.js";
import { siteLibrary } from "./index.js";

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

const QUESTIONS = [
  { id: "q1", question: "Open on Sunday?", answer: "<p>No, we rest.</p>" },
  { id: "q2", question: "Parking?", answer: "<p>Behind the shop.</p>" },
].map((props) => ({ type: "FaqItem", props }));

/** An FAQ with two questions, with `props` over that. */
const faq = (props: Record<string, unknown> = {}) =>
  page(
    renderNodesToHtml(
      [{ type: "Faq", props: { id: "faq", title: "Questions", items: QUESTIONS, ...props } }],
      siteLibrary,
      EDITOR_RENDER_CONTEXT,
    ),
  );

/** A Call to action's frame: its `<section>`'s classes and theme, with `props`. */
const ctaFrame = (props: Record<string, unknown>) => {
  const section = page(
    renderNodesToHtml(
      [{ type: "CallToAction", props: { id: "cta", title: "Order a cake", ...props } }],
      siteLibrary,
      EDITOR_RENDER_CONTEXT,
    ),
  ).querySelector("section.site-cta");
  return { classes: section?.className ?? "", theme: section?.getAttribute("data-theme") };
};

describe("the Call to action's colours (#1257)", () => {
  it("draws the Banner in the theme's dark colour on the page's colours", () => {
    const { classes, theme } = ctaFrame({ variant: "banner" });

    expect(classes).toContain("bg-neutral text-neutral-content");
    expect(theme).toBeNull();
  });

  it("draws a Reversed Banner on the reversed surface, as any section, not the dark colour", () => {
    const { classes, theme } = ctaFrame({ variant: "banner", colors: "inverse" });

    expect(classes).toContain("bg-base-100");
    expect(classes).not.toContain("neutral");
    expect(theme).toBe("wf_inverse");
  });

  it("keeps the button-beside layout's surface either way", () => {
    expect(ctaFrame({ variant: "split" }).classes).toContain("bg-base-200");
    expect(ctaFrame({ variant: "split", colors: "inverse" }).classes).toContain("bg-base-200");
  });
});

describe("the FAQ's layouts (2.7b)", () => {
  it("opens each question in place, as an accordion, unless set otherwise", () => {
    for (const doc of [faq(), faq({ variant: "accordion" })]) {
      const items = [...doc.querySelectorAll("details.site-faq-item")];
      expect(items.map((item) => item.querySelector("summary")?.textContent)).toEqual([
        "Open on Sunday?",
        "Parking?",
      ]);
      expect(doc.querySelector(".max-w-3xl")).not.toBeNull();
    }
  });

  it("puts the questions in two columns on wider screens, each still opening", () => {
    // Wide, as two columns were before 3.21 and format 10 keeps them.
    const doc = faq({ variant: "columns", contentWidth: "wide" });

    expect(doc.querySelector(".grid")?.className).toContain("md:grid-cols-2");
    expect(doc.querySelectorAll(".grid > details.site-faq-item")).toHaveLength(2);
    expect(doc.querySelector(".max-w-6xl")).not.toBeNull();
  });

  it("shows every answer, each question a heading under the FAQ's own", () => {
    const doc = faq({ variant: "open" });

    expect(doc.querySelector("details")).toBeNull();
    const items = [...doc.querySelectorAll(".site-faq-item")];
    expect(items.map((item) => item.querySelector("h3")?.textContent)).toEqual([
      "Open on Sunday?",
      "Parking?",
    ]);
    expect(items[1]?.textContent).toContain("Behind the shop.");
    expect(doc.querySelector("h2")?.textContent).toBe("Questions");
  });

  it("takes the accordion for a layout it doesn't have", () => {
    const doc = faq({ variant: "tabs" });

    expect(doc.querySelectorAll("details.site-faq-item")).toHaveLength(2);
  });
});
