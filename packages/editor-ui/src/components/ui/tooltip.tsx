import { Tooltip as TooltipPrimitive } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "../../lib/cn.js";

/** Shares tooltip timing across the app; wrap the app once. */
export function TooltipProvider({
  delayDuration = 400,
  ...props
}: ComponentProps<typeof TooltipPrimitive.Provider>) {
  return <TooltipPrimitive.Provider delayDuration={delayDuration} {...props} />;
}

/** A tooltip: a {@link TooltipTrigger} and its {@link TooltipContent}. */
export function Tooltip(props: ComponentProps<typeof TooltipPrimitive.Root>) {
  return <TooltipPrimitive.Root data-slot="tooltip" {...props} />;
}

/**
 * Whether `element` has the focus the keyboard gave it (`:focus-visible`), not a click's or the
 * focus a dialog gives back after a click.
 */
function focusVisible(element: Element): boolean {
  try {
    return element.matches(":focus-visible");
  } catch {
    // A DOM without the selector (a test's): as a keyboard's.
    return true;
  }
}

/**
 * The element the tooltip describes; use `asChild` around a button. Focus opens the tooltip only
 * when it's the keyboard's (5.5): a dialog closed with the mouse gives its button the focus back,
 * and a tooltip shown then would sit over whatever is clicked next.
 */
export function TooltipTrigger({
  onFocus,
  ...props
}: ComponentProps<typeof TooltipPrimitive.Trigger>) {
  return (
    <TooltipPrimitive.Trigger
      data-slot="tooltip-trigger"
      {...props}
      onFocus={(event) => {
        onFocus?.(event);
        // Radix opens the tooltip on focus unless the event's default is prevented.
        if (!focusVisible(event.currentTarget)) event.preventDefault();
      }}
    />
  );
}

/** The tooltip's text. */
export function TooltipContent({
  className,
  sideOffset = 4,
  ...props
}: ComponentProps<typeof TooltipPrimitive.Content>) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        data-slot="tooltip-content"
        sideOffset={sideOffset}
        className={cn(
          "z-50 rounded-sm border border-border-strong bg-popover px-2 py-1 text-xs",
          "text-popover-foreground shadow-md animate-in fade-in-0",
          "data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
          className,
        )}
        {...props}
      />
    </TooltipPrimitive.Portal>
  );
}
