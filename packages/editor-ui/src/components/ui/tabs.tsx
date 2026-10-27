import { Tabs as TabsPrimitive } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "../../lib/cn.js";

/** Panel tabs (Add · Layers · Edit…): a 32 px strip on the tabs colour. */
export function Tabs({ className, ...props }: ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root data-slot="tabs" className={cn("flex flex-col", className)} {...props} />
  );
}

/** The strip that holds the {@link TabsTrigger}s: the active one sits on the panel below. */
export function TabsList({ className, ...props }: ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn("flex h-8 shrink-0 items-stretch bg-tabs px-1 pt-1", className)}
      {...props}
    />
  );
}

/**
 * One tab (LF-5): bold, in sentence case. The active tab is lifted out of the strip (#524): a
 * gradient from a lighter top into the panel's own background, its text at full strength, under a
 * 2 px accent edge.
 */
export function TabsTrigger({ className, ...props }: ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-t-sm px-2.5 text-xs font-semibold",
        "text-tab-inactive outline-none hover:text-foreground",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset disabled:text-disabled",
        "data-[state=active]:bg-linear-to-b data-[state=active]:from-tab-active-top data-[state=active]:to-panel",
        "data-[state=active]:text-foreground data-[state=active]:shadow-[inset_0_2px_0_var(--tab-active-edge)]",
        "[&_svg]:size-3.5",
        className,
      )}
      {...props}
    />
  );
}

/** The content shown for the active tab. */
export function TabsContent({ className, ...props }: ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn("min-h-0 flex-1 bg-panel outline-none", className)}
      {...props}
    />
  );
}
