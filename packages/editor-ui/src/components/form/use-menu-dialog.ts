import { useRef } from "react";

/** What {@link useMenuDialog} gives a dropdown menu whose items open dialogs. */
export type MenuDialog<T> = {
  /** Opens `dialog` once the menu has closed; call it from the menu item's `onSelect`. */
  readonly choose: (dialog: T) => void;
  /** The menu content's `onCloseAutoFocus`. */
  readonly onCloseAutoFocus: (event: Event) => void;
};

/**
 * Opens a dialog chosen from a dropdown menu once the menu has closed. Opened at once, the closing
 * menu takes focus back to its button after the dialog has put it in its field, so what the
 * person types goes nowhere. `open` opens the dialog.
 */
export function useMenuDialog<T>(open: (dialog: T) => void): MenuDialog<T> {
  const pending = useRef<{ readonly dialog: T } | null>(null);
  return {
    choose: (dialog) => {
      pending.current = { dialog };
    },
    onCloseAutoFocus: (event) => {
      const next = pending.current;
      pending.current = null;
      if (next !== null) {
        event.preventDefault();
        open(next.dialog);
      }
    },
  };
}
