import type { Viewport } from "@webforge/engine";
import { describe, expect, it } from "vitest";
import { createStore } from "zustand/vanilla";
import { createCanvasView, zoomStep } from "./canvas-view.js";
import { COMMAND_IDS } from "./command-ids.js";
import { createCommandRegistry, matchesShortcut } from "./commands.js";
import { createPreferencesStore } from "./preferences-store.js";
import {
  registerInterfaceZoomCommands,
  registerViewCommands,
  registerViewOptionCommands,
} from "./view-commands.js";

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

describe("registerViewOptionCommands (#857)", () => {
  const setUp = (mac = false) => {
    const registry = createCommandRegistry({ mac });
    const preferences = createPreferencesStore();
    const remove = registerViewOptionCommands(registry, preferences);
    const canvas = () => preferences.getState().preferences.canvas;
    const shown = () => registry.list().map(({ label, menu, shortcut }) => [label, menu, shortcut]);
    return { registry, preferences, remove, canvas, shown };
  };

  it("turns the canvas's outlines and element names on and off, each named for what it does", () => {
    const { registry, remove, canvas, shown } = setUp();
    // Outlines are on and names off, as a new install has them.
    expect(canvas()).toMatchObject({ showOutlines: true, elementNames: false });
    expect(shown()).toEqual([
      ["Hide Outlines", "view", "Mod+Shift+O"],
      ["Show Element Names", "view", "Mod+Shift+N"],
    ]);

    registry.run(COMMAND_IDS.showOutlines);
    registry.run(COMMAND_IDS.elementNames);

    expect(canvas()).toMatchObject({ showOutlines: false, elementNames: true });
    expect(shown()).toEqual(
      expect.arrayContaining([
        ["Show Outlines", "view", "Mod+Shift+O"],
        ["Hide Element Names", "view", "Mod+Shift+N"],
      ]),
    );
    registry.run(COMMAND_IDS.showOutlines);
    expect(canvas().showOutlines).toBe(true);

    remove();
    expect(registry.list()).toEqual([]);
  });

  it("keeps the canvas's other options as they are", () => {
    const { registry, preferences, canvas } = setUp();
    preferences.change({ canvas: { ...canvas(), spacingOnHover: true, extraBottomSpace: true } });
    const before = canvas();

    registry.run(COMMAND_IDS.elementNames);

    expect(canvas()).toEqual({ ...before, elementNames: true });
  });

  it("runs from its keys on Windows and a Mac, Shift giving a capital letter", () => {
    for (const mac of [false, true]) {
      const press = { key: "O", code: "KeyO", shiftKey: true, altKey: false };
      const mod = mac ? { metaKey: true, ctrlKey: false } : { metaKey: false, ctrlKey: true };
      expect(matchesShortcut({ ...press, ...mod }, "Mod+Shift+O", mac)).toBe(true);
      expect(
        matchesShortcut({ ...press, ...mod, key: "N", code: "KeyN" }, "Mod+Shift+N", mac),
      ).toBe(true);
      // Without Shift it's not theirs.
      expect(
        matchesShortcut({ ...press, ...mod, key: "o", shiftKey: false }, "Mod+Shift+O", mac),
      ).toBe(false);
    }
  });
});

describe("registerInterfaceZoomCommands", () => {
  const setUp = (mac = false) => {
    const registry = createCommandRegistry({ mac });
    const saved: unknown[] = [];
    const preferences = createPreferencesStore(
      {},
      { preferences: async (change) => saved.push(change) },
    );
    const remove = registerInterfaceZoomCommands(registry, preferences);
    const zoom = () => preferences.getState().preferences.interfaceZoom;
    const enabled = () => registry.list().map(({ label, enabled }) => [label, enabled]);
    return { registry, preferences, remove, zoom, enabled, saved };
  };

  it("lists Zoom In, Zoom Out and Reset in the View menu, with the standard's keys", () => {
    const { registry, remove } = setUp();

    expect(registry.list().map(({ label, menu, shortcut }) => [label, menu, shortcut])).toEqual([
      ["Zoom In Interface", "view", "Mod+Alt+="],
      ["Zoom Out Interface", "view", "Mod+Alt+-"],
      ["Reset Interface Zoom", "view", "Mod+Alt+0"],
    ]);
    remove();
    expect(registry.list()).toEqual([]);
  });

  it("zooms in and out a level at a time, and saves each level as a preference", () => {
    const { registry, zoom, saved } = setUp();

    registry.run(COMMAND_IDS.interfaceZoomIn);
    expect(zoom()).toBe(1.1);
    registry.run(COMMAND_IDS.interfaceZoomIn);
    expect(zoom()).toBe(1.25);
    registry.run(COMMAND_IDS.interfaceZoomOut);
    registry.run(COMMAND_IDS.interfaceZoomOut);
    registry.run(COMMAND_IDS.interfaceZoomOut);
    expect(zoom()).toBe(0.9);
    expect(saved).toEqual([
      { interfaceZoom: 1.1 },
      { interfaceZoom: 1.25 },
      { interfaceZoom: 1.1 },
      { interfaceZoom: 1 },
      { interfaceZoom: 0.9 },
    ]);
  });

  it("resets to 100%, and is turned off at 100%", () => {
    const { registry, zoom, enabled } = setUp();
    expect(enabled()).toEqual([
      ["Zoom In Interface", true],
      ["Zoom Out Interface", true],
      ["Reset Interface Zoom", false],
    ]);

    registry.run(COMMAND_IDS.interfaceZoomOut);
    expect(enabled()).toContainEqual(["Reset Interface Zoom", true]);
    registry.run(COMMAND_IDS.interfaceZoomReset);

    expect(zoom()).toBe(1);
    expect(enabled()).toContainEqual(["Reset Interface Zoom", false]);
  });

  it("stops at 150% and 80%, each turned off at its limit", () => {
    const { registry, zoom, enabled, saved } = setUp();

    for (let step = 0; step < 10; step++) registry.run(COMMAND_IDS.interfaceZoomIn);
    expect(zoom()).toBe(1.5);
    expect(enabled()).toEqual([
      ["Zoom In Interface", false],
      ["Zoom Out Interface", true],
      ["Reset Interface Zoom", true],
    ]);
    for (let step = 0; step < 10; step++) registry.run(COMMAND_IDS.interfaceZoomOut);
    expect(zoom()).toBe(0.8);
    expect(enabled()).toEqual([
      ["Zoom In Interface", true],
      ["Zoom Out Interface", false],
      ["Reset Interface Zoom", true],
    ]);
    // Each level once on the way up (1.1 to 1.5) and down (1.25 to 0.8); none past a limit.
    expect(saved).toHaveLength(8);
  });

  it("runs from Ctrl+Alt on Windows and from Cmd+Option on a Mac, which types other characters", () => {
    const windows = { ctrlKey: true, metaKey: false, altKey: true, shiftKey: false };
    expect(matchesShortcut({ ...windows, key: "=", code: "Equal" }, "Mod+Alt+=", false)).toBe(true);
    expect(matchesShortcut({ ...windows, key: "-", code: "Minus" }, "Mod+Alt+-", false)).toBe(true);
    expect(matchesShortcut({ ...windows, key: "0", code: "Digit0" }, "Mod+Alt+0", false)).toBe(
      true,
    );
    // The numeric keypad's +.
    expect(
      matchesShortcut({ ...windows, key: "+", code: "NumpadAdd" }, "Mod+Alt+Plus", false),
    ).toBe(true);

    const mac = { ctrlKey: false, metaKey: true, altKey: true, shiftKey: false };
    expect(matchesShortcut({ ...mac, key: "≠", code: "Equal" }, "Mod+Alt+=", true)).toBe(true);
    expect(matchesShortcut({ ...mac, key: "–", code: "Minus" }, "Mod+Alt+-", true)).toBe(true);
    expect(matchesShortcut({ ...mac, key: "º", code: "Digit0" }, "Mod+Alt+0", true)).toBe(true);
    // ⌥⇧= types ± on a Mac: still the key of Zoom In.
    expect(
      matchesShortcut({ ...mac, shiftKey: true, key: "±", code: "Equal" }, "Mod+Alt+=", true),
    ).toBe(true);

    // The canvas's keys stay the canvas's: without Alt they aren't the interface's, and with it
    // they aren't the canvas's.
    const canvas = { ...windows, altKey: false, key: "=", code: "Equal" };
    expect(matchesShortcut(canvas, "Mod+Alt+=", false)).toBe(false);
    expect(matchesShortcut({ ...windows, key: "=", code: "Equal" }, "Mod+=", false)).toBe(false);
    expect(matchesShortcut({ ...mac, key: "º", code: "Digit0" }, "Mod+0", true)).toBe(false);
  });
});
