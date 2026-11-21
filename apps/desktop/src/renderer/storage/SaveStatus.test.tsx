// @vitest-environment happy-dom
import { act, cleanup, render, screen } from "@testing-library/react";
import { TooltipProvider } from "@webforge/editor-ui";
import { afterEach, describe, expect, it } from "vitest";
import { createStore } from "zustand/vanilla";
import type { SaveStatus as Status } from "./autosave.js";
import { SaveStatus } from "./SaveStatus.js";

afterEach(() => cleanup());

function renderStatus(status: Status) {
  const store = createStore<{ status: Status }>()(() => ({ status }));
  render(
    <TooltipProvider>
      <SaveStatus status={store} />
    </TooltipProvider>,
  );
  return store;
}

describe("SaveStatus (P2, #1195)", () => {
  it("is its tick while the title bar is narrow, its words still read out and shown when wide", () => {
    renderStatus("saved");

    const status = screen.getByRole("status");
    expect(status.textContent).toBe("Saved");
    // The words only for screen readers below 960 px, shown from there; the tick the other way.
    expect(screen.getByText("Saved").className).toBe("sr-only @min-[960px]/title-bar:not-sr-only");
    expect(status.querySelector("svg")?.getAttribute("class")).toContain(
      "@min-[960px]/title-bar:hidden",
    );
  });

  it("keeps its words, and no tick, while saving or when a save failed", () => {
    const store = renderStatus("saving");
    expect(screen.getByText("Saving…").className).toBe("");
    expect(screen.getByRole("status").querySelector("svg")).toBeNull();

    act(() => store.setState({ status: "error" }));
    expect(screen.getByRole("status").textContent).toBe("Not saved. Webforge will try again.");
    expect(screen.getByRole("status").querySelector("svg")).toBeNull();
  });
});
