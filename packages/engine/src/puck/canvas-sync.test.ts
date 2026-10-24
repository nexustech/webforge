import { describe, expect, it } from "vitest";
import { createCanvasSync } from "./canvas-sync.js";

describe("CanvasSync (R8)", () => {
  it("starts with Puck showing the app's page, nothing under way", () => {
    const sync = createCanvasSync();

    expect(sync.isShown()).toBe(true);
    expect(sync.isEcho()).toBe(false);
    expect(sync.inAction()).toBe(false);
    expect(sync.isReporting()).toBe(false);
  });

  it("knows Puck shows an older page until the latest is shown, and none once forgotten", () => {
    const sync = createCanvasSync();

    sync.changed();
    expect(sync.isShown()).toBe(false);
    sync.changed();
    sync.shown();
    expect(sync.isShown()).toBe(true);
    // Puck remounted: it shows what it was rendered with, not the app's page.
    sync.forget();
    expect(sync.isShown()).toBe(false);
    sync.shown();
    expect(sync.isShown()).toBe(true);
  });

  it("takes what Puck reports during Webforge's own dispatch for its echo", () => {
    const sync = createCanvasSync();

    const during = sync.apply(() => sync.isEcho());

    expect(during).toBe(true);
    expect(sync.isEcho()).toBe(false);
  });

  it("knows when Puck is inside its own update, and when an edit is being reported", () => {
    const sync = createCanvasSync();

    expect(sync.handleAction(() => sync.inAction())).toBe(true);
    expect(sync.report(() => sync.isReporting())).toBe(true);
    expect(sync.inAction()).toBe(false);
    expect(sync.isReporting()).toBe(false);
  });

  it("clears each flag however its run ends, a throw included", () => {
    const sync = createCanvasSync();
    const fail = () => {
      throw new Error("Puck failed");
    };

    expect(() => sync.apply(fail)).toThrow("Puck failed");
    expect(() => sync.handleAction(fail)).toThrow("Puck failed");
    expect(() => sync.report(fail)).toThrow("Puck failed");
    expect(sync.isEcho()).toBe(false);
    expect(sync.inAction()).toBe(false);
    expect(sync.isReporting()).toBe(false);
  });

  it("keeps the flags apart: an echo isn't a report", () => {
    const sync = createCanvasSync();

    sync.apply(() => {
      expect(sync.isReporting()).toBe(false);
      sync.report(() => {
        expect(sync.isEcho()).toBe(true);
        expect(sync.isReporting()).toBe(true);
      });
      expect(sync.isReporting()).toBe(false);
    });
  });
});
