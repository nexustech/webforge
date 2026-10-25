// @vitest-environment happy-dom
import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useMenuDialog } from "./use-menu-dialog.js";

describe("useMenuDialog", () => {
  it("opens the chosen dialog as the menu closes, keeping focus out of the menu's button", () => {
    const open = vi.fn();
    const { result } = renderHook(() => useMenuDialog<string>(open));
    const closing = new Event("focusOutside", { cancelable: true });

    result.current.choose("rename");
    expect(open).not.toHaveBeenCalled();
    result.current.onCloseAutoFocus(closing);

    expect(open).toHaveBeenCalledExactlyOnceWith("rename");
    expect(closing.defaultPrevented).toBe(true);
  });

  it("leaves a menu closed without a dialog to give focus back to its button, once", () => {
    const open = vi.fn();
    const { result } = renderHook(() => useMenuDialog<string>(open));
    result.current.choose("rename");
    result.current.onCloseAutoFocus(new Event("close", { cancelable: true }));

    const next = new Event("close", { cancelable: true });
    result.current.onCloseAutoFocus(next);

    expect(open).toHaveBeenCalledOnce();
    expect(next.defaultPrevented).toBe(false);
  });
});
