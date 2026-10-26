// @vitest-environment happy-dom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { createWindowDialogs, WindowDialogs } from "./window-dialogs.js";

afterEach(cleanup);

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
