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
    const doc = faq({ variant: "columns" });

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
