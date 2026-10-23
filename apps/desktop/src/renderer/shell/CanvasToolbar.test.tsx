// @vitest-environment happy-dom
import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { CanvasSize } from "@webforge/engine";
import type { PageId } from "@webforge/model";
import { siteLibrary } from "@webforge/site-components";
import { afterEach, describe, expect, it, vi } from "vitest";
import { type CanvasPreferences, DEFAULT_PREFERENCES } from "../../shared/ipc/prefs.js";
import { createEditorSession } from "../editor/editor-session.js";
import { starterSite } from "../editor/starter-site.js";
import { CanvasToolbar } from "./CanvasToolbar.js";
import { CanvasToolbarHost } from "./CanvasToolbarHost.js";
import { viewportFor, widthOf } from "./canvas-size.js";
import { type CanvasZoom, connectCanvasView, createCanvasView } from "./canvas-view.js";

afterEach(cleanup);

const HOME = "page-home" as PageId;
const ABOUT = "page-about" as PageId;

function setUp(
  viewport: "desktop" | number = "desktop",
  size: CanvasSize | null = null,
  canvas: CanvasPreferences = DEFAULT_PREFERENCES.canvas,
) {
  const onShowPage = vi.fn();
  const onViewportChange = vi.fn();
  const onZoomChange = vi.fn();
  const onCanvasChange = vi.fn();
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
      canvas={canvas}
      onCanvasChange={onCanvasChange}
    />,
  );
  const width = () => screen.getByRole("spinbutton", { name: "Canvas width in pixels" });
  return { onShowPage, onViewportChange, onZoomChange, onCanvasChange, width };
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

    expect(screen.queryByText(/ @ /)).toBeNull();
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
    // A report from before the zoom took effect is shown, isn't a re-fit, and asks again.
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

    expect(engine.setZoom.mock.calls).toEqual([["fit"], [2], [2], ["fit"]]);
    expect(stopSize).toHaveBeenCalledOnce();
  });
});

describe("a zoom not shown yet", () => {
  function setUp() {
    let time = 0;
    const view = createCanvasView();
    view.setState({ zoom: 0.5 });
    let report: ((size: CanvasSize) => void) | undefined;
    const engine = {
      setZoom: vi.fn<(zoom: CanvasZoom) => void>(),
      onCanvasSize: (cb: (size: CanvasSize) => void) => {
        report = cb;
        return () => undefined;
      },
    };
    connectCanvasView(engine, view, () => time);
    const fitted = { width: 1280, height: 700, zoom: 0.58 };
    return {
      view,
      engine,
      report: (size = fitted) => report?.(size),
      wait: (ms: number) => {
        time += ms;
      },
    };
  }

  it("is asked for again by every report from before it took effect (#134)", () => {
    const { view, engine, report, wait } = setUp();

    report();
    wait(100);
    report();
    report({ width: 1280, height: 400, zoom: 0.5 });
    wait(2_000);
    report({ width: 1280, height: 420, zoom: 0.5 });

    expect(engine.setZoom.mock.calls).toEqual([[0.5], [0.5], [0.5]]);
    expect(view.getState().zoom).toBe(0.5);
  });

  it("is given up for Fit when the canvas still doesn't show it after a second", () => {
    const { view, engine, report, wait } = setUp();

    report();
    wait(1_000);
    report();

    expect(engine.setZoom.mock.calls).toEqual([[0.5], [0.5], ["fit"]]);
    expect(view.getState().zoom).toBe("fit");
  });
});

describe("View menu and devices (F-ED-25)", () => {
  const user = () => userEvent.setup({ delay: null });

  it("turns the View menu's options on and off, keeping the menu open", async () => {
    const { onCanvasChange } = setUp();

    await user().click(screen.getByRole("button", { name: "View" }));
    const outlines = screen.getByRole("menuitemcheckbox", { name: "Show outlines" });
    expect(outlines.getAttribute("aria-checked")).toBe("true");
    await user().click(screen.getByRole("menuitemcheckbox", { name: "Show spacing on hover" }));
    await user().click(outlines);

    expect(screen.getByRole("menu")).toBeTruthy();
    expect(onCanvasChange.mock.calls).toEqual([
      [{ ...DEFAULT_PREFERENCES.canvas, spacingOnHover: true }],
      [{ ...DEFAULT_PREFERENCES.canvas, showOutlines: false }],
    ]);
  });

  it("lists the devices from the size readout, the person's own included", async () => {
    const canvas = {
      ...DEFAULT_PREFERENCES.canvas,
      devices: [{ id: "d1", name: "Old laptop", width: 1024, height: 600 }],
    };
    const { onViewportChange } = setUp("desktop", { width: 1280, height: 900, zoom: 0.5 }, canvas);

    await user().click(
      screen.getByRole("button", { name: "Page size 1280 × 900 @ 50%: choose a device" }),
    );
    expect(screen.getAllByRole("menuitem").map((item) => item.textContent)).toEqual([
      "Desktop (1280)",
      "Tablet (768)",
      "Mobile (375)",
      "Old laptop (1024 × 600)",
      "Add device…",
    ]);
    await user().click(screen.getByRole("menuitem", { name: "Old laptop (1024 × 600)" }));
    await user().click(screen.getByRole("button", { name: /Page size/ }));
    await user().click(screen.getByRole("menuitem", { name: "Mobile (375)" }));

    expect(onViewportChange.mock.calls).toEqual([[1024], ["mobile"]]);
  });

  it("rotates a device, and is off for a width that is no device's", async () => {
    const { onViewportChange } = setUp(375);
    await user().click(screen.getByRole("button", { name: "Rotate" }));
    expect(onViewportChange).toHaveBeenCalledExactlyOnceWith(812);
    cleanup();

    setUp(900);
    expect((screen.getByRole("button", { name: "Rotate" }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it("adds a device of the person's own, and shows the page at its width", async () => {
    const { onCanvasChange, onViewportChange } = setUp();

    await user().click(screen.getByRole("button", { name: "Devices" }));
    await user().click(screen.getByRole("menuitem", { name: "Add device…" }));
    const dialog = within(await screen.findByRole("dialog", { name: "Add a device" }));
    await user().type(dialog.getByRole("textbox", { name: "Name" }), "Kiosk");
    await user().type(dialog.getByRole("spinbutton", { name: "Width in pixels" }), "1080");
    await user().type(dialog.getByRole("spinbutton", { name: "Height in pixels" }), "100");
    // Too small for the canvas.
    expect((dialog.getByRole("button", { name: "Add Device" }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    await user().type(dialog.getByRole("spinbutton", { name: "Height in pixels" }), "0");
    await user().click(dialog.getByRole("button", { name: "Add Device" }));

    expect(onCanvasChange).toHaveBeenCalledWith({
      ...DEFAULT_PREFERENCES.canvas,
      devices: [{ id: expect.any(String), name: "Kiosk", width: 1080, height: 1000 }],
    });
    expect(onViewportChange).toHaveBeenCalledWith(1080);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("CanvasToolbarHost", () => {
  it("changes the view and the page without an undo step (U6)", async () => {
    const session = createEditorSession(siteLibrary, starterSite());
    const view = createCanvasView();
    render(
      <CanvasToolbarHost
        session={session}
        view={view}
        canvas={DEFAULT_PREFERENCES.canvas}
        onCanvasChange={vi.fn()}
      />,
    );

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
