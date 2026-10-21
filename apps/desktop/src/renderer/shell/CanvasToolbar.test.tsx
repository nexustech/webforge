// @vitest-environment happy-dom
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { CanvasSize } from "@webforge/engine";
import type { PageId } from "@webforge/model";
import { siteLibrary } from "@webforge/site-components";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createEditorSession } from "../editor/editor-session.js";
import { starterSite } from "../editor/starter-site.js";
import { CanvasToolbar, viewportFor, widthOf } from "./CanvasToolbar.js";
import { CanvasToolbarHost } from "./CanvasToolbarHost.js";
import { type CanvasZoom, connectCanvasView, createCanvasView } from "./canvas-view.js";

afterEach(cleanup);

const HOME = "page-home" as PageId;
const ABOUT = "page-about" as PageId;

function setUp(viewport: "desktop" | number = "desktop", size: CanvasSize | null = null) {
  const onShowPage = vi.fn();
  const onViewportChange = vi.fn();
  const onZoomChange = vi.fn();
  render(
    <CanvasToolbar
      pages={[
        { id: HOME, title: "Home" },
        { id: ABOUT, title: "About us" },
      ]}
      shownPageId={HOME}
      onShowPage={onShowPage}
      viewport={viewport}
      onViewportChange={onViewportChange}
      zoom="fit"
      onZoomChange={onZoomChange}
      size={size}
    />,
  );
  const width = () => screen.getByRole("spinbutton", { name: "Canvas width in pixels" });
  return { onShowPage, onViewportChange, onZoomChange, width };
}

describe("CanvasToolbar (F-ED-8)", () => {
  it("names device widths, and treats other widths as custom", () => {
    expect(widthOf("tablet")).toBe(768);
    expect(widthOf(1000)).toBe(1000);
    expect(viewportFor(375)).toBe("mobile");
    expect(viewportFor(900)).toBe(900);
  });

  it("shows another page", async () => {
    const { onShowPage } = setUp();

    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Page shown" }), "About us");

    expect(onShowPage).toHaveBeenCalledWith(ABOUT);
  });

  it("switches device views, and shows the view's width", async () => {
    const { onViewportChange, width } = setUp();

    expect(screen.getByRole("radio", { name: "Desktop" }).getAttribute("aria-checked")).toBe(
      "true",
    );
    expect((width() as HTMLInputElement).value).toBe("1280");
    await userEvent.click(screen.getByRole("radio", { name: "Mobile" }));
    // Clicking the chosen view again keeps it.
    await userEvent.click(screen.getByRole("radio", { name: "Desktop" }));

    expect(onViewportChange.mock.calls).toEqual([["mobile"]]);
  });

  it("takes a custom width, within limits, on Enter; Escape puts it back", async () => {
    const { onViewportChange, width } = setUp(900);

    expect(screen.getByRole("radio", { name: "Desktop" }).getAttribute("aria-checked")).toBe(
      "false",
    );
    await userEvent.clear(width());
    await userEvent.type(width(), "1000{Enter}");
    await userEvent.clear(width());
    await userEvent.type(width(), "100{Enter}");
    await userEvent.clear(width());
    await userEvent.type(width(), "768");
    await act(async () => width().blur());
    await userEvent.clear(width());
    await userEvent.type(width(), "555{Escape}");

    expect(onViewportChange.mock.calls).toEqual([[1000], [320], ["tablet"]]);
    expect((width() as HTMLInputElement).value).toBe("900");
  });
});

describe("zoom and size readout", () => {
  it("shows the size and scale once known, and Fit at the scale it fits at", async () => {
    const { onZoomChange } = setUp("desktop", { width: 1280, height: 2140.4, zoom: 0.584 });

    expect(screen.getByText("1280 × 2140 @ 58%")).toBeTruthy();
    const zoom = screen.getByRole("combobox", { name: "Zoom" });
    expect(screen.getByRole("option", { name: "Fit (58%)" })).toBeTruthy();
    await userEvent.selectOptions(zoom, "150%");
    await userEvent.selectOptions(zoom, "Fit (58%)");

    expect(onZoomChange.mock.calls).toEqual([[1.5], ["fit"]]);
  });

  it("shows no size before the canvas has shown the page", () => {
    setUp();

    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.getByRole("option", { name: "Fit" })).toBeTruthy();
  });

  it("keeps the canvas engine and the view in step", () => {
    const view = createCanvasView();
    let report: ((size: CanvasSize) => void) | undefined;
    const stopSize = vi.fn();
    const engine = {
      setZoom: vi.fn<(zoom: CanvasZoom) => void>(),
      onCanvasSize: vi.fn((cb: (size: CanvasSize) => void) => {
        report = cb;
        return stopSize;
      }),
    };

    const disconnect = connectCanvasView(engine, view);
    view.setState({ zoom: 2 });
    // A report from before the zoom took effect is shown, but isn't a re-fit.
    report?.({ width: 375, height: 900, zoom: 0.6 });
    expect(view.getState()).toEqual({ zoom: 2, size: { width: 375, height: 900, zoom: 0.6 } });
    report?.({ width: 375, height: 450, zoom: 2 });
    expect(view.getState().zoom).toBe(2);
    // The canvas fitted the page again (its frame or the device view changed): Fit is shown.
    report?.({ width: 768, height: 1200, zoom: 0.7 });
    expect(view.getState()).toEqual({ zoom: "fit", size: { width: 768, height: 1200, zoom: 0.7 } });
    report?.({ width: 768, height: 1100, zoom: 0.65 });
    expect(view.getState().zoom).toBe("fit");
    disconnect();
    view.setState({ zoom: 1 });

    expect(engine.setZoom.mock.calls).toEqual([["fit"], [2], ["fit"]]);
    expect(stopSize).toHaveBeenCalledOnce();
  });
});

describe("CanvasToolbarHost", () => {
  it("changes the view and the page without an undo step (U6)", async () => {
    const session = createEditorSession(siteLibrary, starterSite());
    const view = createCanvasView();
    render(<CanvasToolbarHost session={session} view={view} />);

    await userEvent.click(screen.getByRole("radio", { name: "Tablet" }));
    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: "Page shown" }),
      "Page not found",
    );

    expect(session.ui.getState().viewport).toBe("tablet");
    expect(session.history.document.getState().pages[session.ui.getState().pageId]?.kind).toBe(
      "not-found",
    );
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Zoom" }), "50%");
    expect(view.getState().zoom).toBe(0.5);
    act(() => view.setState({ size: { width: 768, height: 1000, zoom: 0.5 } }));
    expect(screen.getByText("768 × 1000 @ 50%")).toBeTruthy();
    expect(session.history.entries()).toEqual([]);
  });
});
