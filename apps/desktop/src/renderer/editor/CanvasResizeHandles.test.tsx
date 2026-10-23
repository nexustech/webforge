// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CanvasResizeHandles } from "./CanvasResizeHandles.js";

afterEach(cleanup);

/** A container 1000 px wide holding a canvas frame `width` × `zoom` wide, centred. */
function setUp(width: number, zoom = 1) {
  const container = document.createElement("div");
  const frame = document.createElement("iframe");
  container.append(frame);
  document.body.append(container);
  container.getBoundingClientRect = () => new DOMRect(0, 0, 1000, 600);
  const shown = width * zoom;
  frame.getBoundingClientRect = () => new DOMRect(500 - shown / 2, 0, shown, 600);
  const ref = createRef<HTMLElement>();
  Object.assign(ref, { current: container });
  const onChange = vi.fn();
  render(
    <CanvasResizeHandles
      container={ref}
      width={width}
      zoom={zoom}
      devices={[{ id: "k", name: "Kiosk", width: 400, height: 700 }]}
      onChange={onChange}
    />,
  );
  const handle = (side: "left" | "right") =>
    screen.getByRole("separator", { name: `Canvas width, ${side} edge` });
  return { onChange, handle };
}

describe("CanvasResizeHandles (F-ED-25, UX-8)", () => {
  it("sits on the frame's edges", () => {
    const { handle } = setUp(600);

    expect(handle("left").style.left).toBe("200px");
    expect(handle("right").style.left).toBe("800px");
    expect(handle("right").getAttribute("aria-valuenow")).toBe("600");
  });

  it("drags an edge to a width twice as far, snapping to a device, with a live readout", () => {
    const { onChange, handle } = setUp(600);
    const right = handle("right");

    fireEvent.pointerDown(right, { clientX: 800, pointerId: 1 });
    // 80 px out: 600 + 160 = 760, which snaps to Tablet (768).
    fireEvent.pointerMove(right, { clientX: 880, pointerId: 1 });
    expect(screen.getByText("768 px · Tablet")).toBeTruthy();
    expect(right.style.left).toBe("884px");
    fireEvent.pointerUp(right, { clientX: 880, pointerId: 1 });

    expect(onChange).toHaveBeenCalledExactlyOnceWith("tablet");
    expect(screen.queryByText("768 px · Tablet")).toBeNull();
  });

  it("places an edge freely with Alt, and from the left edge, at the canvas's zoom", () => {
    const { onChange, handle } = setUp(600, 0.5);
    const left = handle("left");

    fireEvent.pointerDown(left, { clientX: 350, pointerId: 1 });
    // 10 screen px outward at 50%: 600 + 40 = 640, near no device.
    fireEvent.pointerMove(left, { clientX: 340, pointerId: 1, altKey: true });
    fireEvent.pointerUp(left, { clientX: 340, pointerId: 1 });

    expect(onChange).toHaveBeenCalledExactlyOnceWith(640);
  });

  it("puts the width back on Escape", () => {
    const { onChange, handle } = setUp(600);
    const right = handle("right");

    fireEvent.pointerDown(right, { clientX: 800, pointerId: 1 });
    fireEvent.pointerMove(right, { clientX: 900, pointerId: 1 });
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    fireEvent.pointerUp(right, { clientX: 900, pointerId: 1 });

    expect(onChange).not.toHaveBeenCalled();
  });

  it("takes the arrow keys, outward to widen, Shift for larger steps", () => {
    const { onChange, handle } = setUp(600);

    fireEvent.keyDown(handle("right"), { key: "ArrowRight" });
    fireEvent.keyDown(handle("left"), { key: "ArrowRight", shiftKey: true });
    fireEvent.keyDown(handle("left"), { key: "ArrowUp" });

    expect(onChange.mock.calls).toEqual([[610], [550]]);
  });
});
