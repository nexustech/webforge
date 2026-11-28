// @vitest-environment happy-dom
import { act, cleanup, render, screen } from "@testing-library/react";
import { TooltipProvider } from "@webforge/editor-ui";
import { afterEach, describe, expect, it } from "vitest";
import { createStore } from "zustand/vanilla";
import type { AutosaveState, SaveStatus as Status } from "./autosave.js";
import { SaveStatus } from "./SaveStatus.js";

afterEach(() => cleanup());

function renderStatus(status: Status) {
  const store = createStore<AutosaveState>()(() => ({ status }));
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

  it("says the site couldn't be kept as the older version saved it, when that stopped the save (#1525)", () => {
    const store = renderStatus("saving");

    act(() => store.setState({ status: "error", failure: "no-copy" }));
    expect(screen.getByRole("status").textContent).toBe(
      "Not saved: Webforge couldn't keep a copy of this site as the older version saved it. Free some space on the disk. Webforge will try again.",
    );
    act(() => store.setState({ status: "error", failure: "unknown" }));
    expect(screen.getByRole("status").textContent).toBe("Not saved. Webforge will try again.");
  });
});
