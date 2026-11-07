import { useRef } from "react";

/** A dialog content's own focus handlers, which {@link useReturnFocus} runs first. */
type AutoFocusHandlers = {
  readonly onOpenAutoFocus?: ((event: Event) => void) | undefined;
  readonly onCloseAutoFocus?: ((event: Event) => void) | undefined;
};

/**
 * Gives the focus back, as a dialog closes, to what had it as the dialog opened (5.5). Radix gives
 * it to the dialog's trigger, and a dialog opened from a command, a shortcut or a menu has none,
 * so the focus went to the page's body and the keyboard started again from the top of the window.
 * A handler of the dialog's own that prevents the default keeps the focus its own way, and with
 * nothing to go back to (it has gone from the page), Radix's way stays.
 */
export function useReturnFocus({ onOpenAutoFocus, onCloseAutoFocus }: AutoFocusHandlers): {
  readonly onOpenAutoFocus: (event: Event) => void;
  readonly onCloseAutoFocus: (event: Event) => void;
} {
  const opener = useRef<HTMLElement | null>(null);
  return {
    // Called before the dialog moves the focus in, so what has it is what opened the dialog.
    onOpenAutoFocus: (event) => {
      const active =
        event.target instanceof Node ? event.target.ownerDocument?.activeElement : null;
      opener.current = active instanceof HTMLElement ? active : null;
      onOpenAutoFocus?.(event);
    },
    onCloseAutoFocus: (event) => {
      onCloseAutoFocus?.(event);
      const back = opener.current;
      opener.current = null;
      if (event.defaultPrevented || back === null || !back.isConnected) return;
      event.preventDefault();
      back.focus({ preventScroll: true });
    },
  };
}
