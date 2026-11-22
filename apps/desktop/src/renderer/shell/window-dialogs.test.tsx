// @vitest-environment happy-dom
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";
import { createWindowDialogs, WindowDialogs } from "./window-dialogs.js";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("the window's dialogs (2.3b)", () => {
  it("draws each registered dialog once, until it's removed", () => {
    const dialogs = createWindowDialogs();
    render(<WindowDialogs registry={dialogs} />);
    const list = dialogs.list();

    let remove: () => void = () => undefined;
    act(() => {
      remove = dialogs.register({
        id: "studio",
        component: () => <p>Studio</p>,
        close: () => undefined,
      });
    });
    expect(screen.getAllByText("Studio")).toHaveLength(1);
    expect(dialogs.list()).not.toBe(list);
    expect(() =>
      dialogs.register({ id: "studio", component: () => null, close: () => undefined }),
    ).toThrow('The dialog "studio" is already registered');

    act(() => remove());
    expect(screen.queryByText("Studio")).toBeNull();
    // Removing twice is harmless.
    act(() => remove());
    expect(dialogs.list()).toEqual([]);
  });
});

describe("a window dialog's error (#1320)", () => {
  /**
   * A dialog that throws `where` while `broken`, once it opens, as its area draws it, with a button
   * behind it standing for the rest of the editor.
   */
  function setUp(where: "render" | "effect") {
    // React says what it caught; the window's root reports it in the app.
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const state = createStore(() => ({ open: false, broken: true }));
    function Broken() {
      const { open, broken } = useStore(state);
      if (where === "render" && open && broken) throw new Error("A dialog's mistake");
      useEffect(() => {
        if (where === "effect" && open && broken) throw new Error("A dialog's mistake");
      }, [open, broken]);
      return open ? <p>The dialog</p> : null;
    }
    const close = vi.fn(() => state.setState({ open: false }));
    const dialogs = createWindowDialogs();
    dialogs.register({ id: "broken", component: Broken, close });
    const behind = vi.fn();
    render(
      <>
        <button type="button" onClick={behind}>
          Behind
        </button>
        <WindowDialogs registry={dialogs} />
      </>,
    );
    /** Its command: opens it, as its area does. */
    const open = () => act(() => state.setState({ open: true }));
    return { state, close, behind, open, user: userEvent.setup({ delay: null }) };
  }

  for (const where of ["render", "effect"] as const) {
    it(`shows its message in its place when it throws in ${where}, the editor still working`, async () => {
      const { close, behind, open, user } = setUp(where);
      open();

      const message = screen.getByRole("alert");
      expect(message.textContent).toContain(
        "Something went wrong in this window. Your work is saved.",
      );
      expect(screen.getByRole("dialog", { name: "This window couldn't be shown" })).toBeDefined();
      expect(screen.queryByText("The dialog")).toBeNull();

      await user.click(screen.getByRole("button", { name: "Close" }));
      expect(close).toHaveBeenCalledOnce();
      expect(screen.queryByRole("alert")).toBeNull();
      await user.click(screen.getByRole("button", { name: "Behind" }));
      expect(behind).toHaveBeenCalledOnce();
    });
  }

  it("closes for good a dialog that throws every time, with Close or Escape, and opens again", async () => {
    const { state, close, open, user } = setUp("render");
    open();
    expect(screen.getByRole("alert")).toBeDefined();

    // Close: the message goes and stays gone, the dialog closed in its state.
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("alert")).toBeNull();
    expect(state.getState().open).toBe(false);

    // Its command opens it again: still broken, so its message again, which Escape closes.
    open();
    expect(screen.getByRole("alert")).toBeDefined();
    await user.keyboard("{Escape}");
    expect(close).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(state.getState().open).toBe(false);

    // Mended, it opens as itself.
    act(() => state.setState({ broken: false }));
    open();
    expect(screen.getByText("The dialog")).toBeDefined();
  });
});
