import { HoverCard as HoverCardPrimitive } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "../../lib/cn.js";

/**
 * A card that shows more about what the pointer rests on, or what has keyboard focus: a
 * {@link HoverCardTrigger} and its {@link HoverCardContent}. Only extra detail: nothing in it may
 * be the one way to do something, as it never takes focus.
 */
export function HoverCard({
  openDelay = 400,
  closeDelay = 100,
  ...props
}: ComponentProps<typeof HoverCardPrimitive.Root>) {
  return (
    <HoverCardPrimitive.Root
      data-slot="hover-card"
      openDelay={openDelay}
      closeDelay={closeDelay}
      {...props}
    />
  );
}

/** The element the card tells more about; use `asChild` around a button. */
export function HoverCardTrigger(props: ComponentProps<typeof HoverCardPrimitive.Trigger>) {
  return <HoverCardPrimitive.Trigger data-slot="hover-card-trigger" {...props} />;
}

/** The card itself, beside its trigger. */
export function HoverCardContent({
  className,
  side = "right",
  sideOffset = 8,
  ...props
}: ComponentProps<typeof HoverCardPrimitive.Content>) {
  return (
    <HoverCardPrimitive.Portal>
      <HoverCardPrimitive.Content
        data-slot="hover-card-content"
        side={side}
        sideOffset={sideOffset}
        className={cn(
          "z-50 rounded-md border border-border-strong bg-popover p-2 text-popover-foreground",
          "shadow-md outline-none animate-in fade-in-0",
          "data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
          className,
        )}
        {...props}
      />
    </HoverCardPrimitive.Portal>
  );
}
