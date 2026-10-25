// @vitest-environment happy-dom
import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { CanvasSize } from "@webforge/engine";
import type { PageId } from "@webforge/model";
import { siteLibrary } from "@webforge/site-components";
import { afterEach, describe, expect, it, vi } from "vitest";
import { type CanvasPreferences, DEFAULT_PREFERENCES } from "../../shared/ipc/prefs.js";
import { createPreviewStore } from "../editor/edit-previews.js";
import { currentPage, type EditorSession } from "../editor/editor-session.js";
import { headerToolbar } from "../editor/HeaderToolbar.js";
import { HEADING_LEVELS, headingToolbar } from "../editor/HeadingToolbar.js";
import { sessionWith } from "../testing/fixtures.js";
import { CanvasToolbar } from "./CanvasToolbar.js";
import { CanvasToolbarHost } from "./CanvasToolbarHost.js";
import { viewportFor, widthOf } from "./canvas-size.js";
import { type CanvasZoom, connectCanvasView, createCanvasView } from "./canvas-view.js";
import { ContextualToolbarsProvider } from "./contextual-toolbar-context.js";
import { type ContextualToolbarRegistry, createContextualToolbars } from "./contextual-toolbars.js";
import { openedDialog } from "./opened-dialog.test-helper.js";
import { createPreferencesStore } from "./preferences-store.js";

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

  it("zooms in and out a level at a time from the scale it shows, Fit included (LF-4)", async () => {
    // Fit at 58%: in goes to the next level up, out to the next down.
    const { onZoomChange } = setUp("desktop", { width: 1280, height: 2140.4, zoom: 0.584 });

    await userEvent.click(screen.getByRole("button", { name: "Zoom In" }));
    await userEvent.click(screen.getByRole("button", { name: "Zoom Out" }));

    expect(onZoomChange.mock.calls).toEqual([[0.75], [0.5]]);
  });

  it("can't zoom in past the largest zoom, or out past the smallest", () => {
    // Fit at 200%, the largest: only zooming out is left.
    setUp("desktop", { width: 320, height: 640, zoom: 2 });

    expect((screen.getByRole("button", { name: "Zoom In" }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    expect((screen.getByRole("button", { name: "Zoom Out" }) as HTMLButtonElement).disabled).toBe(
      false,
    );
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

  it("adds no more devices than the preferences keep", async () => {
    const devices = Array.from({ length: 20 }, (_, i) => ({
      id: `d${i}`,
      name: `Device ${i}`,
      width: 400 + i,
      height: 800,
    }));
    setUp("desktop", null, { ...DEFAULT_PREFERENCES.canvas, devices });

    await user().click(screen.getByRole("button", { name: "Devices" }));

    expect(
      screen.getByRole("menuitem", { name: "Add device…" }).getAttribute("aria-disabled"),
    ).toBe("true");
  });

  it("adds a device of the person's own, and shows the page at its width", async () => {
    const { onCanvasChange, onViewportChange } = setUp();

    await user().click(screen.getByRole("button", { name: "Devices" }));
    await user().click(screen.getByRole("menuitem", { name: "Add device…" }));
    // It opens as the menu closes: wait until it takes clicks.
    const dialog = await openedDialog("Add a device");
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

/** The canvas toolbar on `session`, with the contextual toolbars `toolbars` has. */
function host(
  session: EditorSession,
  view = createCanvasView(),
  toolbars: ContextualToolbarRegistry = createContextualToolbars(),
) {
  render(
    <ContextualToolbarsProvider registry={toolbars}>
      <CanvasToolbarHost session={session} view={view} preferences={createPreferencesStore()} />
    </ContextualToolbarsProvider>,
  );
  return toolbars;
}

describe("CanvasToolbarHost", () => {
  it("changes the view and the page without an undo step (U6)", async () => {
    const session = sessionWith();
    const view = createCanvasView();
    host(session, view);

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

  it("keeps the row under it, empty, while the selection has no toolbar (SP-4)", () => {
    host(sessionWith());
    const row = screen.getByRole("toolbar", { name: "Selected element" });
    expect(row.childElementCount).toBe(0);
  });

  it("shows the selected element's own toolbar in the row under it, if its type has one (SP-4)", () => {
    const session = sessionWith();
    const toolbars = host(session);
    act(() => {
      toolbars.register({
        id: "text",
        types: ["Text"],
        component: ({ nodeId }) => <p>Toolbar for {nodeId}</p>,
      });
    });

    expect(screen.queryByText(/Toolbar for/)).toBeNull();
    act(() => session.select("text-1"));
    expect(screen.getByText("Toolbar for text-1")).toBeTruthy();
    // A Heading has no toolbar here.
    act(() => session.select("heading-1"));
    expect(screen.queryByText(/Toolbar for/)).toBeNull();
  });
});

describe("Heading level toolbar (SP-4)", () => {
  function setUpHeading() {
    const session = sessionWith();
    const flush = vi.fn();
    const toolbars = createContextualToolbars();
    toolbars.register(headingToolbar({ session, flush }));
    host(session, createCanvasView(), toolbars);
    act(() => session.select("heading-1"));
    // The starter page's Heading, in its first Section.
    const size = () => {
      const section = currentPage(session)?.doc.content[0];
      const elements = section?.props.content as { props: { size?: unknown } }[] | undefined;
      return elements?.[0]?.props.size;
    };
    return { session, flush, size };
  }

  it("is next in the Tab order after the canvas toolbar, in the row under it", async () => {
    setUpHeading();
    const row = screen.getByRole("toolbar", { name: "Selected element" });
    const toolbar = screen.getByRole("toolbar", { name: "Canvas" });
    const controls = toolbar.querySelectorAll<HTMLElement>("button, select, input");
    controls[controls.length - 1]?.focus();

    await userEvent.tab();

    // The Heading's own level, the one chosen.
    expect(document.activeElement).toBe(within(row).getByRole("radio", { name: "Title" }));
  });

  it("shows no Heading level in Content mode, which locks the design (R9)", () => {
    const session = sessionWith();
    const toolbars = createContextualToolbars();
    toolbars.register(headingToolbar({ session, flush: vi.fn() }));
    const preferences = createPreferencesStore();
    preferences.changeMode("content");
    render(
      <ContextualToolbarsProvider registry={toolbars}>
        <CanvasToolbarHost session={session} view={createCanvasView()} preferences={preferences} />
      </ContextualToolbarsProvider>,
    );
    act(() => session.select("heading-1"));

    expect(screen.getByRole("toolbar", { name: "Selected element" }).childElementCount).toBe(0);
    act(() => preferences.changeMode("design"));
    expect(screen.getByRole("radiogroup", { name: "Heading level" })).toBeTruthy();
  });

  it("offers a Heading's sizes as its levels", () => {
    const sizes = siteLibrary.components.Heading?.fields.size;
    expect(sizes?.kind === "select" ? sizes.options.map((option) => option.value) : []).toEqual(
      HEADING_LEVELS.map((level) => level.value),
    );
  });

  it("sets the selected Heading's level as one undo step, named as the Edit panel names it", async () => {
    const { session, flush, size } = setUpHeading();
    const checked = (name: string) =>
      screen.getByRole("radio", { name }).getAttribute("aria-checked") === "true";
    // The starter page's Heading is its title.
    expect(screen.getByRole("radiogroup", { name: "Heading level" })).toBeTruthy();
    expect(checked("Title")).toBe(true);

    await userEvent.click(screen.getByRole("radio", { name: "Subheading" }));

    expect(flush).toHaveBeenCalled();
    expect(size()).toBe("small");
    expect(session.history.entries().map((entry) => entry.label)).toEqual(["Changed Heading size"]);
    expect(checked("Subheading")).toBe(true);

    // The level it has already: nothing to change.
    await userEvent.click(screen.getByRole("radio", { name: "Subheading" }));
    expect(session.history.entries()).toHaveLength(1);

    act(() => {
      session.history.undo();
    });
    expect(checked("Title")).toBe(true);
  });
});

describe("Show mobile menu (UX-26)", () => {
  function setUpHeader(mode: "design" | "content" = "design") {
    const session = sessionWith();
    const previews = createPreviewStore();
    const toolbars = createContextualToolbars();
    toolbars.register(headerToolbar({ session, previews }));
    const preferences = createPreferencesStore();
    preferences.changeMode(mode);
    render(
      <ContextualToolbarsProvider registry={toolbars}>
        <CanvasToolbarHost session={session} view={createCanvasView()} preferences={preferences} />
      </ContextualToolbarsProvider>,
    );
    act(() => session.select("header"));
    const toggle = () => screen.queryByRole("button", { name: "Show mobile menu" });
    return { session, previews, toggle };
  }

  it("is offered on the Header only while the canvas shows small screens", () => {
    const { session, toggle } = setUpHeader();
    expect(toggle()).toBeNull();

    act(() => session.setViewport("mobile"));
    expect(toggle()).not.toBeNull();
    // A custom width below the site's wide layout shows its small-screen menu too.
    act(() => session.setViewport(700));
    expect(toggle()).not.toBeNull();
    act(() => session.setViewport("tablet"));
    expect(toggle()).toBeNull();
  });

  it("turns the preview on and off without changing the site: no undo step (U6)", async () => {
    const { session, previews, toggle } = setUpHeader();
    act(() => session.setViewport("mobile"));

    await userEvent.click(toggle() as HTMLElement);
    expect(previews.getState().mobileMenu).toBe(true);
    expect(toggle()?.getAttribute("aria-pressed")).toBe("true");
    await userEvent.click(toggle() as HTMLElement);

    expect(previews.getState().mobileMenu).toBe(false);
    expect(session.history.entries()).toEqual([]);
  });

  it("is offered in Content mode too, as it changes nothing", () => {
    const { session, toggle } = setUpHeader("content");

    act(() => session.setViewport("mobile"));

    expect(toggle()).not.toBeNull();
  });
});
