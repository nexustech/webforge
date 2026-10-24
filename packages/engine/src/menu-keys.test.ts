// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { installMenuKeys, isMenuKey } from "./menu-keys.js";

const key = (init: KeyboardEventInit) => ({
  key: "",
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  shiftKey: false,
  ...init,
});

describe("isMenuKey", () => {
  it.each([
    [{ key: "F10", shiftKey: true }, true],
    [{ key: "ContextMenu" }, true],
    [{ key: "F10" }, false],
    [{ key: "F10", shiftKey: true, ctrlKey: true }, false],
    [{ key: "F10", shiftKey: true, metaKey: true }, false],
    [{ key: "F10", shiftKey: true, altKey: true }, false],
    [{ key: "ContextMenu", ctrlKey: true }, false],
  ] as const)("reads %o as %s", (init, expected) => {
    expect(isMenuKey(key(init))).toBe(expected);
  });
});

describe("installMenuKeys", () => {
  const stops: (() => void)[] = [];
  afterEach(() => {
    for (const stop of stops.splice(0)) stop();
    document.body.replaceChildren();
  });

  /** A focused button, and the `contextmenu` events it gets. */
  const focused = () => {
    const button = document.createElement("button");
    document.body.append(button);
    button.focus();
    const menus = vi.fn<(event: MouseEvent) => void>();
    button.addEventListener("contextmenu", menus);
    return { button, menus };
  };
  const press = (init: KeyboardEventInit) => {
    const event = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init });
    document.activeElement?.dispatchEvent(event);
    return event;
  };

  it("on macOS, asks the focused element for its menu on Shift+F10, as the keyboard (#287)", () => {
    const { menus } = focused();
    stops.push(installMenuKeys(document, true));

    const event = press({ key: "F10", shiftKey: true });

    expect(event.defaultPrevented).toBe(true);
    expect(menus).toHaveBeenCalledOnce();
    const menu = menus.mock.calls[0]?.[0];
    expect(menu?.bubbles).toBe(true);
    // Not the right button: the menus open under the element, not at a pointer.
    expect(menu?.button).toBe(0);
  });

  it("on macOS, does the same for the menu key, and nothing for other keys", () => {
    const { menus } = focused();
    stops.push(installMenuKeys(document, true));

    press({ key: "ContextMenu" });
    press({ key: "F10" });
    press({ key: "F10", shiftKey: true, metaKey: true });

    expect(menus).toHaveBeenCalledOnce();
  });

  it("leaves a key press something else has handled", () => {
    const { button, menus } = focused();
    button.addEventListener("keydown", (event) => event.preventDefault());
    stops.push(installMenuKeys(document, true));

    press({ key: "F10", shiftKey: true });

    expect(menus).not.toHaveBeenCalled();
  });

  it("does nothing elsewhere, where the browser opens the menu itself", () => {
    const { menus } = focused();
    stops.push(installMenuKeys(document, false));

    const event = press({ key: "F10", shiftKey: true });

    expect(event.defaultPrevented).toBe(false);
    expect(menus).not.toHaveBeenCalled();
  });

  it("stops", () => {
    const { menus } = focused();
    installMenuKeys(document, true)();

    press({ key: "F10", shiftKey: true });

    expect(menus).not.toHaveBeenCalled();
  });
});
