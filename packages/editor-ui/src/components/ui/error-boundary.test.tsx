import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ErrorBoundary, ErrorFallback } from "./error-boundary.js";

afterEach(cleanup);

describe("ErrorBoundary (R3)", () => {
  it("shows the fallback when its children throw, and tries them again on reset", async () => {
    let fail = true;
    function Panel() {
      if (fail) throw new Error("Rosa's Bakery");
      return <p>Pages</p>;
    }
    // React reports the caught error on the console; the root's onCaughtError reports it in the app.
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    render(
      <div>
        <ErrorBoundary
          fallback={(reset) => (
            <ErrorFallback message="Panel failed" actionLabel="Reload panel" onAction={reset} />
          )}
        >
          <Panel />
        </ErrorBoundary>
        <p>Canvas</p>
      </div>,
    );

    expect(screen.getByRole("alert").textContent).toContain("Panel failed");
    // The rest of the window is still there.
    expect(screen.getByText("Canvas")).toBeDefined();

    fail = false;
    await userEvent.setup().click(screen.getByRole("button", { name: "Reload panel" }));
    expect(screen.getByText("Pages")).toBeDefined();
    expect(screen.queryByRole("alert")).toBeNull();
    log.mockRestore();
  });
});
