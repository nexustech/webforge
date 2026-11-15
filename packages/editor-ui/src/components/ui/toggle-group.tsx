import { ToggleGroup as ToggleGroupPrimitive } from "radix-ui";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "../../lib/cn.js";
import { Tooltip, TooltipContent, TooltipTrigger, useTooltipWhenCut } from "./tooltip.js";

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

/** Props of {@link ToggleGroupItem}. */
type ToggleGroupItemProps = Omit<
  ComponentProps<typeof ToggleGroupPrimitive.Item>,
  "title" | "asChild"
> & {
  /**
   * What the option is, shown on hover and on keyboard focus (#1011), in place of the browser's
   * `title`. It doesn't name the option: an icon-only one still needs its `aria-label`.
   */
  readonly tooltip?: ReactNode;
  /** The tooltip only while the option's text is cut short, to show the whole of it. */
  readonly tooltipWhenCut?: boolean;
};

/** One option of a {@link ToggleGroup}; the chosen one is filled with the accent colour. */
export function ToggleGroupItem({
  className,
  tooltip,
  tooltipWhenCut = false,
  children,
  ...props
}: ToggleGroupItemProps) {
  const { trigger, root } = useTooltipWhenCut(tooltipWhenCut);
  const item = {
    "data-slot": "toggle-group-item",
    className: cn(
      "inline-flex h-[26px] min-w-7 items-center justify-center gap-1.5 rounded-sm px-2 text-xs",
      "font-medium text-muted-foreground outline-none hover:text-foreground",
      "focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:text-disabled",
      "data-[state=on]:bg-accent data-[state=on]:text-accent-foreground",
      "[&_svg]:size-4 [&_svg]:shrink-0",
      className,
    ),
    ...props,
  };
  if (tooltip === undefined)
    return <ToggleGroupPrimitive.Item {...item}>{children}</ToggleGroupPrimitive.Item>;
  return (
    <Tooltip {...root}>
      {/* The item outside, the tooltip's trigger inside: each sets `data-state`, and the item's
          ("on") must win, as its look follows it. */}
      <ToggleGroupPrimitive.Item {...item} asChild>
        <TooltipTrigger ref={trigger}>{children}</TooltipTrigger>
      </ToggleGroupPrimitive.Item>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}
