import { type AnimationEvent, useEffect, useRef } from "react";

/** The handlers of a Radix menu's content that {@link useMenuClosing} takes part in. */
export type MenuClosingHandlers<
  Content extends HTMLElement,
  PointerOutside extends Event,
  FocusOutside extends Event,
> = {
  readonly onAnimationStart?: ((event: AnimationEvent<Content>) => void) | undefined;
  readonly onPointerDownOutside?: ((event: PointerOutside) => void) | undefined;
  readonly onFocusOutside?: ((event: FocusOutside) => void) | undefined;
};

/** Whether `content`, a menu's content still on the page, is fading out after closing. */
function isClosing(content: HTMLElement | null): boolean {
  return content?.isConnected === true && content.dataset.state === "closed";
}

/**
 * For a Radix menu's content (Menubar, DropdownMenu): while it fades out after closing, a press or
 * the focus outside it no longer dismisses it (#689). Open, either dismisses it as before.
 *
 * The closing content keeps its outside listeners until it is removed, and dismissing it closes
 * whatever menu is open now: a press on its trigger opened the menu, then the closing content
 * dismissed, in the same render, and the menu stayed closed; a press on another menu's trigger
 * opened that one, whose focus then moved outside the closing content, which closed it.
 *
 * Whether a press came while it was closing is noted as the press starts, before any handler runs:
 * Radix sends its outside press with `flushSync`, which first draws the menu the trigger has just
 * opened. The content's element comes from its own animations: it fades in before it can close.
 *
 * Returns the three handlers, each calling the caller's own first.
 */
export function useMenuClosing<
  Content extends HTMLElement,
  PointerOutside extends Event,
  FocusOutside extends Event,
>(
  own: MenuClosingHandlers<Content, PointerOutside, FocusOutside>,
): {
  readonly [Handler in keyof MenuClosingHandlers<
    Content,
    PointerOutside,
    FocusOutside
  >]-?: NonNullable<MenuClosingHandlers<Content, PointerOutside, FocusOutside>[Handler]>;
} {
  const content = useRef<Content | null>(null);
  const pressedWhileClosing = useRef(false);
  useEffect(() => {
    const note = () => {
      pressedWhileClosing.current = isClosing(content.current);
    };
    document.addEventListener("pointerdown", note, true);
    return () => document.removeEventListener("pointerdown", note, true);
  }, []);
  return {
    onAnimationStart: (event) => {
      own.onAnimationStart?.(event);
      // Not a submenu's, whose events reach here through React's tree.
      if (event.target === event.currentTarget) content.current = event.currentTarget;
    },
    onPointerDownOutside: (event) => {
      own.onPointerDownOutside?.(event);
      if (pressedWhileClosing.current) event.preventDefault();
    },
    onFocusOutside: (event) => {
      own.onFocusOutside?.(event);
      if (isClosing(content.current)) event.preventDefault();
    },
  };
}
