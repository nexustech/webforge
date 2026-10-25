// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { showDropMark, showOutlineChip } from "./marks.js";

/** Element `id`, drawn at `box` by its first child, as Puck wraps each element. */
function element(id: string, box: { x: number; y: number; width: number; height: number }) {
  const wrapper = document.createElement("div");
  wrapper.setAttribute("data-puck-component", id);
  const drawn = document.createElement("section");
  drawn.getBoundingClientRect = () => new DOMRect(box.x, box.y, box.width, box.height);
  wrapper.getBoundingClientRect = drawn.getBoundingClientRect;
  wrapper.append(drawn);
  return wrapper;
}

const marks = (kind: string) => [
  ...document.querySelectorAll<HTMLElement>(`[data-wf-mark="${kind}"]`),
];

describe("the canvas's marks (SP-8, SP-10)", () => {
  afterEach(() => document.body.replaceChildren());

  it("names an outlined element in a chip above it, one at a time, and none for null", () => {
    document.body.append(
      element("a", { x: 10, y: 100, width: 200, height: 50 }),
      element("b", { x: 10, y: 160, width: 200, height: 50 }),
    );

    showOutlineChip(document, "a", "Hero", 1);
    showOutlineChip(document, "b", "Text", 1);
    const [chip] = marks("outline");
    expect(marks("outline")).toHaveLength(1);
    expect(chip?.textContent).toBe("Text");
    // 18 px above its top, at its left edge.
    expect([chip?.style.left, chip?.style.top]).toEqual(["10px", "142px"]);

    showOutlineChip(document, null, undefined, 1);
    expect(marks("outline")).toHaveLength(0);
  });

  it("keeps the chip inside an element at the top of the page, and its height at any zoom", () => {
    document.body.append(element("a", { x: 0, y: 4, width: 200, height: 50 }));

    // At half size the chip is 36 frame pixels tall on screen's 18: no room above.
    showOutlineChip(document, "a", "Header", 0.5);
    expect(marks("outline")[0]?.style.top).toBe("4px");
  });

  it("marks a drop after an element along its bottom edge, with the dragged element's chip", () => {
    document.body.append(
      element("a", { x: 10, y: 100, width: 200, height: 50 }),
      element("b", { x: 10, y: 160, width: 200, height: 50 }),
    );

    showDropMark(document, { nodeId: "a", place: "after", name: "Gallery" }, 1);

    const line = document.querySelector<HTMLElement>(".wf-mark-line");
    expect([line?.style.left, line?.style.top, line?.style.width, line?.style.height]).toEqual([
      "10px",
      "149px",
      "200px",
      "1px",
    ]);
    expect(document.querySelector(".wf-mark-chip")?.textContent).toBe("Gallery");

    showDropMark(document, null, 1);
    expect(marks("drop")).toHaveLength(0);
  });

  it("draws the line upright for an element beside its siblings, as a Columns' column", () => {
    document.body.append(
      element("left", { x: 0, y: 100, width: 300, height: 200 }),
      element("right", { x: 300, y: 100, width: 300, height: 200 }),
    );

    showDropMark(document, { nodeId: "left", place: "before", name: "Column" }, 1);

    const line = document.querySelector<HTMLElement>(".wf-mark-line");
    expect([line?.style.left, line?.style.top, line?.style.width, line?.style.height]).toEqual([
      "0px",
      "100px",
      "1px",
      "200px",
    ]);
  });
});
