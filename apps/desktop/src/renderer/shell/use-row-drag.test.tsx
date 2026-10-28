// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { pickUp } from "../testing/row-drag.js";
import { type RowDragKeys, useRowDrag } from "./use-row-drag.js";

afterEach(cleanup);

const ROWS = ["a", "b", "c"] as const;

/** A list of three rows dragged with {@link useRowDrag}; `c` can't be picked up. */
function List({
  onDrop,
  onClick,
}: {
  readonly onDrop: (from: string, row: string, keys: RowDragKeys) => void;
  readonly onClick: (row: string) => void;
}) {
  const drag = useRowDrag<string>({
    type: "application/x-test",
    rows: ROWS,
    keyOf: (row) => row,
    onDrop: (from, row, _place, keys) => onDrop(from, row, keys),
  });
  return (
    <ul>
      {ROWS.map((row) => (
        <li key={row} {...drag.rowProps(row, row !== "c")}>
          <button type="button" onClick={() => onClick(row)}>
            {row}
          </button>
          {drag.dragging === row ? " (dragging)" : ""}
        </li>
      ))}
    </ul>
  );
}

const setUp = () => {
  const onDrop = vi.fn();
  const onClick = vi.fn();
  const view = render(<List onDrop={onDrop} onClick={onClick} />);
  const row = (name: string) => screen.getByRole("button", { name }).closest("li") as HTMLElement;
  return { onDrop, onClick, row, view };
};

/** The style that forces the cursor while a row is dragged, if one is. */
const dragStyle = () =>
  [...document.head.querySelectorAll("style")].find((style) =>
    style.textContent?.includes("cursor"),
  );

describe("useRowDrag (#271)", () => {
  it("drops a row with the keys held from before the press, as the browser's own drag can't", () => {
    const { onDrop, row } = setUp();

    pickUp(row("a"), row("b"), { ctrlKey: true, shiftKey: true }).drop();

    expect(onDrop).toHaveBeenCalledWith(
      "a",
      "b",
      expect.objectContaining({ ctrlKey: true, shiftKey: true }),
    );
  });

  it("picks a row up only once the pointer moves, so a press and release is a click", () => {
    const { onDrop, onClick, row } = setUp();
    const button = screen.getByRole("button", { name: "a" });

    fireEvent.pointerDown(button, { pointerId: 1, button: 0, clientX: 0, clientY: 0 });
    fireEvent.pointerMove(button, { pointerId: 1, clientX: 2, clientY: 1 });
    expect(row("a").textContent).not.toContain("dragging");
    fireEvent.pointerUp(button, { pointerId: 1, clientX: 2, clientY: 1 });
    fireEvent.click(button);

    expect(onDrop).not.toHaveBeenCalled();
    expect(onClick).toHaveBeenCalledWith("a");
  });

  it("swallows the click that follows a drop, and puts a row back on Escape", () => {
    const { onDrop, onClick, row } = setUp();

    pickUp(row("a"), row("a")).drop();
    fireEvent.click(screen.getByRole("button", { name: "a" }));
    expect(onClick).not.toHaveBeenCalled();

    const drag = pickUp(row("b"), row("a"));
    expect(row("b").textContent).toContain("dragging");
    drag.cancel();
    expect(row("b").textContent).not.toContain("dragging");
    drag.drop();

    expect(onDrop.mock.calls.map(([from, to]) => [from, to])).toEqual([["a", "a"]]);
  });

  it("leaves a row that can't be dragged, and a press with another button, alone", () => {
    const { onDrop, row } = setUp();

    pickUp(row("c"), row("a")).drop();
    fireEvent.pointerDown(row("a"), { pointerId: 2, button: 2, clientX: 0, clientY: 0 });
    fireEvent.pointerMove(row("b"), { pointerId: 2, clientX: 20, clientY: 0 });
    fireEvent.pointerUp(row("b"), { pointerId: 2, clientX: 20, clientY: 0 });

    expect(onDrop).not.toHaveBeenCalled();
    expect(row("c").getAttribute("data-row-draggable")).toBe("false");
    // Never the browser's own drag, which would carry the row's text instead.
    expect(row("a").getAttribute("draggable")).toBe("false");
  });

  it("ends a drag let go where it wasn't seen: a move with no button down, or the window left (review)", () => {
    const { onDrop, row } = setUp();

    pickUp(row("a"), row("b"));
    expect(row("a").textContent).toContain("dragging");
    expect(dragStyle()?.textContent).toContain("cursor: grabbing !important");
    fireEvent.pointerMove(row("b"), { pointerId: 1, clientX: 30, clientY: 0, buttons: 0 });
    expect(row("a").textContent).not.toContain("dragging");
    expect(dragStyle()).toBeUndefined();

    pickUp(row("a"), row("b"));
    fireEvent.blur(window);
    expect(row("a").textContent).not.toContain("dragging");
    expect(onDrop).not.toHaveBeenCalled();
  });

  it("drops with the list's callbacks as they are when it's let go, not as they were at the press", () => {
    const first = vi.fn();
    const latest = vi.fn();
    const view = render(<List onDrop={first} onClick={vi.fn()} />);
    const row = (name: string) => screen.getByRole("button", { name }).closest("li") as HTMLElement;

    const drag = pickUp(row("a"), row("b"));
    view.rerender(<List onDrop={latest} onClick={vi.fn()} />);
    drag.drop();

    expect(first).not.toHaveBeenCalled();
    expect(latest).toHaveBeenCalledWith("a", "b", expect.anything());
  });
});
