import type { PuckAction } from "@puckeditor/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CanvasSize, Viewport } from "../canvas-engine.js";
import { createCanvasView } from "./canvas-view.js";
import type { PuckApi } from "./engine-support.js";
import type { ZoomConfig } from "./puck-dom.js";

/** A stand-in for Puck's API: the width it shows, and the zoom our patch reaches. */
function fakePuck(width: number, zoom: ZoomConfig) {
  const state = { width, zoom };
  const api = {
    appState: {
      ui: {
        viewports: {
          get current() {
            return { width: state.width };
          },
        },
      },
    },
    __private: {
      flushRichText: () => false,
      getZoomConfig: () => state.zoom,
      setZoomConfig: (next: ZoomConfig) => {
        state.zoom = next;
      },
    },
  } as unknown as PuckApi;
  return { state, api };
}

/** The width a `setUi` dispatch asks Puck to show. */
const widthOf = (action: PuckAction) =>
  action.type === "setUi" && typeof action.ui === "function"
    ? (
        action.ui({ viewports: { current: { width: 0 } } } as never) as {
          viewports: { current: { width: number } };
        }
      ).viewports.current.width
    : undefined;

describe("canvas view (R8)", () => {
  const frames: FrameRequestCallback[] = [];
  beforeEach(() => {
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => frames.push(cb));
    vi.stubGlobal("cancelAnimationFrame", () => frames.splice(0));
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    frames.splice(0);
  });
  const nextFrame = () => {
    for (const frame of frames.splice(0)) frame(0);
  };

  it("shows the app's view in Puck once, and reports nothing until Puck shows it", () => {
    const { api } = fakePuck(1280, { zoom: 1, autoZoom: 1, rootHeight: 800 });
    const dispatch = vi.fn<(action: PuckAction) => void>();
    const view = createCanvasView(() => api, dispatch);
    const chosen: Viewport[] = [];
    view.onViewport((viewport) => chosen.push(viewport));

    view.setViewport("tablet");
    view.show();

    expect(dispatch).toHaveBeenCalledOnce();
    expect(widthOf(dispatch.mock.calls[0]?.[0] as PuckAction)).toBe(768);
    // Puck still shows Desktop as the Tablet width travels: not the user's choice.
    view.shown(1280);
    view.shown(768);
    expect(chosen).toEqual([]);
    expect(view.width()).toBe(768);
  });

  it("reports the user's own choice in Puck, by its device's name or as a width", () => {
    const { api } = fakePuck(1280, { zoom: 1, autoZoom: 1, rootHeight: 800 });
    const view = createCanvasView(() => api, vi.fn());
    const chosen: Viewport[] = [];
    view.onViewport((viewport) => chosen.push(viewport));

    view.shown(375);
    view.shown(900);
    view.shown("100%");

    expect(chosen).toEqual(["mobile", 900]);
  });

  it("fills the canvas in Desktop view, never under the desktop layout's width (PH2-18)", () => {
    const { state, api } = fakePuck(1280, { zoom: 1, autoZoom: 1, rootHeight: 800 });
    const dispatch = vi.fn<(action: PuckAction) => void>((action) => {
      state.width = widthOf(action) ?? state.width;
    });
    const view = createCanvasView(() => api, dispatch);
    const shownWidths = () => dispatch.mock.calls.map(([action]) => widthOf(action));

    // Unmeasured, Puck starts filling the canvas, and nothing is sent until the room is known.
    expect(view.startWidth()).toBe("100%");
    view.show();
    expect(dispatch).not.toHaveBeenCalled();
    view.fit(1500.6);
    expect(view.startWidth()).toBe(1500);
    expect(view.width()).toBe(1500);
    view.fit(1500);
    view.fit(900);
    // Narrower than the desktop layout: still desktop, zoomed out by Puck.
    expect(view.width()).toBe(1024);
    expect(shownWidths()).toEqual([1500, 1024]);

    // Tablet and fixed widths keep their width as the canvas changes.
    view.setViewport("tablet");
    view.fit(1700);
    view.setViewport(1440);
    view.fit(1800);
    expect(view.width()).toBe(1440);
    view.setViewport("desktop");
    expect(view.width()).toBe(1800);
    expect(shownWidths()).toEqual([1500, 1024, 768, 1440, 1800]);
  });

  it("sends Desktop's first measured width even when it is the width it started with", () => {
    const { state, api } = fakePuck(1280, { zoom: 1, autoZoom: 1, rootHeight: 800 });
    (state as { width: number | string }).width = "100%";
    const dispatch = vi.fn<(action: PuckAction) => void>();
    const view = createCanvasView(() => api, dispatch);
    view.fit(1280);
    expect(dispatch.mock.calls.map(([action]) => widthOf(action))).toEqual([1280]);
  });

  it("takes a fixed width chosen in Puck for that width, not for Desktop", () => {
    const { api } = fakePuck(1280, { zoom: 1, autoZoom: 1, rootHeight: 800 });
    const view = createCanvasView(() => api, vi.fn());
    const chosen: Viewport[] = [];
    view.onViewport((viewport) => chosen.push(viewport));
    view.shown(1440);
    view.fit(1900);
    expect(chosen).toEqual([1440]);
    expect(view.width()).toBe(1440);
  });

  it("waits for Puck: nothing shown before it is ready", () => {
    const dispatch = vi.fn();
    const view = createCanvasView(() => null, dispatch);

    view.setViewport("mobile");
    view.zoom(2);

    expect(dispatch).not.toHaveBeenCalled();
    expect(view.width()).toBe(375);
  });

  it("zooms to a scale, or to Puck's fitting zoom", () => {
    const { state, api } = fakePuck(1280, { zoom: 1, autoZoom: 0.6, rootHeight: 800 });
    const view = createCanvasView(() => api, vi.fn());

    view.zoom(1.5);
    expect(state.zoom.zoom).toBe(1.5);
    view.zoom("fit");
    expect(state.zoom.zoom).toBe(0.6);
    view.zoom(0);
    expect(state.zoom.zoom).toBe(0.6);
  });

  it("reports the size and zoom once per change, at the next frame", () => {
    const { state, api } = fakePuck(1280, { zoom: 1, autoZoom: 1, rootHeight: 812.4 });
    const view = createCanvasView(() => api, vi.fn());
    const sizes: CanvasSize[] = [];
    view.onSize((size) => sizes.push(size));

    view.measure();
    view.measure();
    nextFrame();
    view.measure();
    nextFrame();
    state.zoom = { ...state.zoom, zoom: 0.5 };
    view.measure();
    nextFrame();

    expect(sizes).toEqual([
      { width: 1280, height: 812, zoom: 1 },
      { width: 1280, height: 812, zoom: 0.5 },
    ]);
    // A listener added later gets the current size at once.
    const late: CanvasSize[] = [];
    view.onSize((size) => late.push(size));
    expect(late).toEqual([{ width: 1280, height: 812, zoom: 0.5 }]);
  });

  it("stops a size about to be reported", () => {
    const { api } = fakePuck(1280, { zoom: 1, autoZoom: 1, rootHeight: 800 });
    const view = createCanvasView(() => api, vi.fn());
    const sizes: CanvasSize[] = [];
    view.onSize((size) => sizes.push(size));

    view.measure();
    view.stopMeasuring();
    nextFrame();

    expect(sizes).toEqual([]);
  });
});
