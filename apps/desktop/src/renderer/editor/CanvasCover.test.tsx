// @vitest-environment happy-dom
import { act, cleanup, render, screen } from "@testing-library/react";
import { createFakeEngine } from "@webforge/test-utils/renderer";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CANVAS_COVER_MESSAGE_MS, CANVAS_COVER_TIMEOUT_MS, CanvasCover } from "./CanvasCover.js";

const failures = vi.hoisted(() => vi.fn());
vi.mock("../log.js", () => ({ reportFailure: failures }));

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  failures.mockClear();
});

describe("the canvas's cover (#1013)", () => {
  it("says the site is opening once 500 ms have passed, until the canvas shows it styled (#1167)", () => {
    vi.useFakeTimers();
    const engine = createFakeEngine({ unstyled: true });
    render(<CanvasCover engine={engine} />);
    // Covered at once, but plain: a site that draws sooner shows no message flashing past.
    expect(screen.getByRole("status").textContent).toBe("");
    act(() => vi.advanceTimersByTime(CANVAS_COVER_MESSAGE_MS));
    expect(screen.getByRole("status").textContent).toBe("Opening your site…");

    act(() => engine.showStyled());
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("covers a canvas started again, and none already styled", () => {
    const first = createFakeEngine();
    const shown = render(<CanvasCover engine={first} />);
    expect(screen.queryByRole("status")).toBeNull();

    shown.rerender(<CanvasCover engine={createFakeEngine({ unstyled: true })} />);
    expect(screen.getByRole("status")).toBeTruthy();
  });

  it("shows the page anyway when the styles never come, and logs it", () => {
    vi.useFakeTimers();
    render(<CanvasCover engine={createFakeEngine({ unstyled: true })} />);
    act(() => vi.advanceTimersByTime(CANVAS_COVER_TIMEOUT_MS - 1));
    expect(screen.getByRole("status")).toBeTruthy();

    act(() => vi.advanceTimersByTime(1));
    expect(screen.queryByRole("status")).toBeNull();
    expect(failures).toHaveBeenCalledWith("canvas.styles", expect.any(Error));
  });

  it("covers the canvas before it has an engine", () => {
    render(<CanvasCover engine={null} />);
    expect(screen.getByRole("status")).toBeTruthy();
  });
});
