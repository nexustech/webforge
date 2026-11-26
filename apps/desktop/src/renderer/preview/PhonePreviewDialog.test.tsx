// @vitest-environment happy-dom
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createStore } from "zustand/vanilla";
import { PhonePreviewDialog, type PhoneState } from "./PhonePreviewDialog.js";

afterEach(cleanup);

describe("PhonePreviewDialog (3.2)", () => {
  it("offers Stop Phone Preview while a phone can open the preview, and only then (#1438)", async () => {
    const state = createStore<PhoneState>(() => ({ status: "starting" }));
    const onStop = vi.fn();
    render(<PhonePreviewDialog state={state} onStop={onStop} />);
    expect(screen.queryByRole("button", { name: "Stop Phone Preview" })).toBeNull();

    act(() => state.setState({ status: "ready", url: "http://192.168.1.23:5002/x/" }, true));
    await userEvent.click(screen.getByRole("button", { name: "Stop Phone Preview" }));
    expect(onStop).toHaveBeenCalledOnce();

    act(() => state.setState({ status: "offline" }, true));
    expect(screen.queryByRole("button", { name: "Stop Phone Preview" })).toBeNull();
  });
});
