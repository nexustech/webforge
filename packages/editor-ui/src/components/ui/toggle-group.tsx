import { ToggleGroup as ToggleGroupPrimitive } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "../../lib/cn.js";

/** A segmented control: Desktop · Tablet · Mobile, Design | Content. */
export function ToggleGroup({
  className,
  ...props
}: ComponentProps<typeof ToggleGroupPrimitive.Root>) {
  return (
    <ToggleGroupPrimitive.Root
      data-slot="toggle-group"
      className={cn("inline-flex items-center rounded-md bg-input p-px", className)}
      {...props}
    />
  );
}

/** One option of a {@link ToggleGroup}; the chosen one is filled with the accent colour. */
export function ToggleGroupItem({
  className,
  ...props
}: ComponentProps<typeof ToggleGroupPrimitive.Item>) {
  return (
    <ToggleGroupPrimitive.Item
      data-slot="toggle-group-item"
      className={cn(
        "inline-flex h-[26px] min-w-7 items-center justify-center gap-1.5 rounded-sm px-2 text-xs",
        "font-medium text-muted-foreground outline-none hover:text-foreground",
        "focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:text-disabled",
        "data-[state=on]:bg-accent data-[state=on]:text-accent-foreground",
        "[&_svg]:size-4 [&_svg]:shrink-0",
        className,
      )}
      {...props}
    />
  );
}
