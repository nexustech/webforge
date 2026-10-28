import { renderHook, waitFor } from "@testing-library/react";
import { DEFAULT_THEME } from "@webforge/model";
import { describe, expect, it, vi } from "vitest";
import type { CanvasApi } from "../../../shared/ipc/canvas.js";
import { useClassCatalogue } from "./class-catalogue.js";

// @vitest-environment happy-dom

/** A theme no other test asks about, so the catalogues kept between tests aren't shared. */
const THEME = { ...DEFAULT_THEME, radius: { box: "l", field: "l", selector: "l" } } as const;

function canvasAnswering(...answers: ("loaded" | "failed")[]): CanvasApi {
  const classCatalogue = vi.fn<CanvasApi["classCatalogue"]>();
  for (const answer of answers) {
    classCatalogue.mockResolvedValueOnce(
      answer === "loaded"
        ? { status: "loaded", classes: ["p-4"], variants: [] }
        : { status: "failed" },
    );
  }
  return {
    classCatalogue,
    classCss: () => Promise.resolve({ status: "failed" }),
    compileCss: () => Promise.resolve({ status: "failed" }),
    itemHtml: () => Promise.resolve({ status: "failed" }),
  };
}

describe("the class catalogue (#276)", () => {
  it("is asked for again after it failed, and kept once it's come", async () => {
    const api = canvasAnswering("failed", "loaded");
    const canvas = () => api;
    const first = renderHook(() => useClassCatalogue(canvas, THEME));
    await waitFor(() => expect(api.classCatalogue).toHaveBeenCalledTimes(1));
    expect(first.result.current).toBeUndefined();
    first.unmount();

    // The failure isn't kept: the next field asks again, and gets it.
    await Promise.resolve();
    const second = renderHook(() => useClassCatalogue(canvas, THEME));
    await waitFor(() => expect(second.result.current).toEqual({ classes: ["p-4"], variants: [] }));
    second.unmount();

    const third = renderHook(() => useClassCatalogue(canvas, THEME));
    await waitFor(() => expect(third.result.current).toBeDefined());
    expect(api.classCatalogue).toHaveBeenCalledTimes(2);
  });
});
