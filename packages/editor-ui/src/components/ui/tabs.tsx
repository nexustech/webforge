import { Tabs as TabsPrimitive } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "../../lib/cn.js";

/** Panel tabs (Add · Layers · Edit…): a 32 px strip on the tabs colour. */
export function Tabs({ className, ...props }: ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root data-slot="tabs" className={cn("flex flex-col", className)} {...props} />
  );
}

/** The strip that holds the {@link TabsTrigger}s. */
export function TabsList({ className, ...props }: ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn("flex h-8 shrink-0 items-stretch bg-tabs px-1", className)}
      {...props}
    />
  );
}

/** One tab; the active tab is in the foreground colour with a ring-coloured underline. */
export function TabsTrigger({ className, ...props }: ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "inline-flex items-center gap-1.5 border-b-2 border-transparent px-2.5 text-xs font-medium",
        "uppercase tracking-wide text-tab-inactive outline-none hover:text-foreground",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset disabled:text-disabled",
        "data-[state=active]:border-ring data-[state=active]:text-foreground [&_svg]:size-3.5",
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
