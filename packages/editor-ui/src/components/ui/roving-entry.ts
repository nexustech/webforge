import { type FocusEvent, useState } from "react";

/**
 * Props for the root of a Radix roving focus group (a list of tabs, a toggle group) that take its
 * own element out of the tab order once one of its items has had the focus (#1650).
 *
 * Radix keeps the root `tabIndex=0` so the keyboard can get in before any item is the roving tab
 * stop, handing the focus on to the active item. But a dialog's focus trap (Radix's FocusScope)
 * wraps Shift+Tab to the dialog's last control only from its first tabbable element, and with the
 * group first in a dialog (Theme Studio's sections, a link's kind) that is the root, not the item:
 * Shift+Tab from the item went out of the dialog and the trap put it straight back, a keyboard
 * trap. Radix takes the root out of the order while Shift+Tab leaves it, but by a state change
 * after the event, once the trap has already counted. So once an item is the stop (Radix keeps one
 * from then on), the root is `-1` for good, and the trap counts the item.
 *
 * Spread before the caller's own props; `tabIndex` is given only once set, as Radix spreads these
 * over its own and an undefined one would take the root out of the order before any item is a
 * stop.
 */
export function useRovingEntry<E extends Element>(
  onFocus: ((event: FocusEvent<E>) => void) | undefined,
): { readonly tabIndex?: -1; readonly onFocus: (event: FocusEvent<E>) => void } {
  const [entered, setEntered] = useState(false);
  return {
    ...(entered ? { tabIndex: -1 as const } : {}),
    onFocus: (event) => {
      if (event.target !== event.currentTarget) setEntered(true);
      onFocus?.(event);
    },
  };
}
