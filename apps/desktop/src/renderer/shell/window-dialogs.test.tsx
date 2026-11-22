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
      remove = dialogs.register({ id: "studio", component: () => <p>Studio</p> });
    });
    expect(screen.getAllByText("Studio")).toHaveLength(1);
    expect(dialogs.list()).not.toBe(list);
    expect(() => dialogs.register({ id: "studio", component: () => null })).toThrow(
      'The dialog "studio" is already registered',
    );

    act(() => remove());
    expect(screen.queryByText("Studio")).toBeNull();
    // Removing twice is harmless.
    act(() => remove());
    expect(dialogs.list()).toEqual([]);
  });
});

describe("a window dialog's error (#1320)", () => {
  /**
   * A dialog that throws while `broken` once it opens, `where` it throws, with a button behind it
   * standing for the rest of the editor.
   */
  function setUp(where: "render" | "effect", withClose = true) {
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
    dialogs.register({ id: "broken", component: Broken, ...(withClose ? { close } : {}) });
    const behind = vi.fn();
    render(
      <>
        <button type="button" onClick={behind}>
          Behind
        </button>
        <WindowDialogs registry={dialogs} />
      </>,
    );
    return { state, close, behind, user: userEvent.setup({ delay: null }) };
  }

  for (const where of ["render", "effect"] as const) {
    it(`shows its message in its place when it throws in ${where}, closed and opened again`, async () => {
      const { state, close, behind, user } = setUp(where);
      act(() => state.setState({ open: true }));

      const message = screen.getByRole("alert");
      expect(message.textContent).toContain("Something went wrong in it. Your work is saved.");
      expect(screen.getByRole("dialog", { name: "This window couldn't be shown" })).toBeDefined();
      expect(screen.queryByText("The dialog")).toBeNull();

      // Its button closes it, and its area's state with it.
      await user.click(screen.getByRole("button", { name: "Close" }));
      expect(close).toHaveBeenCalledOnce();
      expect(screen.queryByRole("alert")).toBeNull();
      // The editor behind it works, and the dialog opens again, as it is now.
      await user.click(screen.getByRole("button", { name: "Behind" }));
      expect(behind).toHaveBeenCalledOnce();
      act(() => state.setState({ open: true, broken: false }));
      expect(screen.getByText("The dialog")).toBeDefined();
    });
  }

  it("closes its message with Escape too, and without its own close draws it again", async () => {
    const { state, close, user } = setUp("render", false);
    act(() => state.setState({ open: true }));
    expect(screen.getByRole("alert")).toBeDefined();

    // Mended meanwhile: drawn again as its state is, still open.
    act(() => state.setState({ broken: false }));
    await user.keyboard("{Escape}");
    expect(close).not.toHaveBeenCalled();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByText("The dialog")).toBeDefined();
  });
});
