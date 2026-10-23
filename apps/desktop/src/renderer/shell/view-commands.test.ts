import type { Viewport } from "@webforge/engine";
import { describe, expect, it } from "vitest";
import { createStore } from "zustand/vanilla";
import { createCanvasView, zoomStep } from "./canvas-view.js";
import { COMMAND_IDS } from "./command-ids.js";
import { createCommandRegistry } from "./commands.js";
import { registerViewCommands } from "./view-commands.js";

describe("zoomStep", () => {
  it("goes one of the toolbar's levels in or out, staying at either end", () => {
    expect(zoomStep(1, "in")).toBe(1.5);
    expect(zoomStep(1, "out")).toBe(0.75);
    // From a fitted scale between levels.
    expect(zoomStep(0.62, "in")).toBe(0.75);
    expect(zoomStep(0.62, "out")).toBe(0.5);
    expect(zoomStep(2, "in")).toBe(2);
    expect(zoomStep(0.25, "out")).toBe(0.25);
    // Reported scales round: 0.749 is 75%.
    expect(zoomStep(0.749, "in")).toBe(1);
  });
});

describe("registerViewCommands (F-ED-27)", () => {
  const setUp = () => {
    const registry = createCommandRegistry({ mac: false });
    const ui = createStore<{ viewport: Viewport }>()(() => ({ viewport: "desktop" }));
    const view = createCanvasView();
    const remove = registerViewCommands(
      registry,
      { setViewport: (viewport) => ui.setState({ viewport }) },
      view,
    );
    return { registry, ui, view, remove };
  };

  it("zooms from the scale the canvas shows, to 100% and back to Fit", () => {
    const { registry, view } = setUp();
    view.setState({ size: { width: 1280, height: 800, zoom: 0.62 } });

    registry.run(COMMAND_IDS.zoomIn);
    expect(view.getState().zoom).toBe(0.75);
    registry.run(COMMAND_IDS.zoomIn);
    expect(view.getState().zoom).toBe(1);
    registry.run(COMMAND_IDS.zoomOut);
    expect(view.getState().zoom).toBe(0.75);
    registry.run(COMMAND_IDS.zoomActual);
    expect(view.getState().zoom).toBe(1);
    registry.run(COMMAND_IDS.zoomFit);
    expect(view.getState().zoom).toBe("fit");
  });

  it("shows each device view, with the standard's keys in the View menu", () => {
    const { registry, ui, remove } = setUp();

    registry.run(COMMAND_IDS.mobileView);
    expect(ui.getState().viewport).toBe("mobile");
    registry.run(COMMAND_IDS.tabletView);
    expect(ui.getState().viewport).toBe("tablet");
    registry.run(COMMAND_IDS.desktopView);
    expect(ui.getState().viewport).toBe("desktop");
    expect(registry.list().map(({ label, menu, shortcut }) => [label, menu, shortcut])).toEqual([
      ["Zoom In", "view", "Mod+="],
      ["Zoom Out", "view", "Mod+-"],
      ["Actual Size", "view", "Mod+0"],
      ["Zoom to Fit", "view", "Mod+9"],
      ["Desktop View", "view", "Mod+1"],
      ["Tablet View", "view", "Mod+2"],
      ["Mobile View", "view", "Mod+3"],
    ]);

    remove();
    expect(registry.list()).toEqual([]);
  });
});
