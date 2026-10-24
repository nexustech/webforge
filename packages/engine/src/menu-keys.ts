type KeyInfo = Pick<KeyboardEvent, "key" | "ctrlKey" | "metaKey" | "altKey" | "shiftKey">;

/** Whether a key press asks for a context menu: Shift+F10, or the keyboard's menu key. */
export function isMenuKey(event: KeyInfo): boolean {
  if (event.ctrlKey || event.metaKey || event.altKey) {
    return false;
  }
  return event.key === "ContextMenu" || (event.key === "F10" && event.shiftKey);
}

/**
 * Opens context menus from the keyboard on macOS (#287). Chromium turns Shift+F10 and the menu key
 * into a `contextmenu` event on Windows and Linux only; on macOS this does the same in `document`:
 * a `contextmenu` on the focused element, at its bottom left, which the element menu (1.35) and
 * the Add panel's menu take as the keyboard's (no right button). Elsewhere it does nothing, so no
 * menu opens twice. Returns a function that stops it.
 */
export function installMenuKeys(
  document: Document,
  mac: boolean = /^mac/i.test(document.defaultView?.navigator.platform ?? ""),
): () => void {
  if (!mac) {
    return () => undefined;
  }
  const onKeyDown = (event: KeyboardEvent) => {
    const view = document.defaultView;
    const target = document.activeElement ?? document.body;
    if (event.defaultPrevented || !isMenuKey(event) || view === null || target === null) {
      return;
    }
    event.preventDefault();
    const box = target.getBoundingClientRect();
    target.dispatchEvent(
      new view.MouseEvent("contextmenu", {
        bubbles: true,
        cancelable: true,
        view,
        clientX: box.left + 16,
        clientY: box.bottom,
      }),
    );
  };
  document.addEventListener("keydown", onKeyDown);
  return () => document.removeEventListener("keydown", onKeyDown);
}
