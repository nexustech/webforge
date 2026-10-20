import { CheckIcon, ChevronRightIcon } from "lucide-react";
import { Menubar as MenubarPrimitive } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "../../lib/cn.js";
import { menuStyles } from "./menu-styles.js";

/** The app menu bar in the title bar (File, Edit, View, Help). */
export function Menubar({ className, ...props }: ComponentProps<typeof MenubarPrimitive.Root>) {
  return (
    <MenubarPrimitive.Root
      data-slot="menubar"
      className={cn("flex h-7 items-center gap-0.5", className)}
      {...props}
    />
  );
}

/** One top-level menu. */
export function MenubarMenu(props: ComponentProps<typeof MenubarPrimitive.Menu>) {
  return <MenubarPrimitive.Menu data-slot="menubar-menu" {...props} />;
}

/** A top-level menu's title (File, Edit…). */
export function MenubarTrigger({
  className,
  ...props
}: ComponentProps<typeof MenubarPrimitive.Trigger>) {
  return (
    <MenubarPrimitive.Trigger
      data-slot="menubar-trigger"
      className={cn(
        "flex h-6 select-none items-center rounded-sm px-2 text-sm outline-none hover:bg-hover",
        "focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:bg-accent",
        className,
      )}
      {...props}
    />
  );
}

/** The open menu. */
export function MenubarContent({
  className,
  align = "start",
  alignOffset = -4,
  sideOffset = 6,
  ...props
}: ComponentProps<typeof MenubarPrimitive.Content>) {
  return (
    <MenubarPrimitive.Portal>
      <MenubarPrimitive.Content
        data-slot="menubar-content"
        align={align}
        alignOffset={alignOffset}
        sideOffset={sideOffset}
        className={cn(menuStyles.content, "min-w-48", className)}
        {...props}
      />
    </MenubarPrimitive.Portal>
  );
}

/** A menu item. `variant="destructive"` for Delete. */
export function MenubarItem({
  className,
  inset,
  variant = "default",
  ...props
}: ComponentProps<typeof MenubarPrimitive.Item> & {
  readonly inset?: boolean;
  readonly variant?: "default" | "destructive";
}) {
  return (
    <MenubarPrimitive.Item
      data-slot="menubar-item"
      data-variant={variant}
      className={cn(menuStyles.item, inset === true && menuStyles.inset, className)}
      {...props}
    />
  );
}

/** A menu item with a tick when on (View → Advanced mode). */
export function MenubarCheckboxItem({
  className,
  children,
  ...props
}: ComponentProps<typeof MenubarPrimitive.CheckboxItem>) {
  return (
    <MenubarPrimitive.CheckboxItem
      data-slot="menubar-checkbox-item"
      className={cn(menuStyles.item, menuStyles.indicatorItem, className)}
      {...props}
    >
      <span className={menuStyles.indicator}>
        <MenubarPrimitive.ItemIndicator>
          <CheckIcon />
        </MenubarPrimitive.ItemIndicator>
      </span>
      {children}
    </MenubarPrimitive.CheckboxItem>
  );
}

/** A line between groups of items. */
export function MenubarSeparator({
  className,
  ...props
}: ComponentProps<typeof MenubarPrimitive.Separator>) {
  return (
    <MenubarPrimitive.Separator
      data-slot="menubar-separator"
      className={cn(menuStyles.separator, className)}
      {...props}
    />
  );
}

/** The keyboard shortcut shown at the end of an item. */
export function MenubarShortcut({ className, ...props }: ComponentProps<"span">) {
  return (
    <span data-slot="menubar-shortcut" className={cn(menuStyles.shortcut, className)} {...props} />
  );
}

/** A submenu (File → Recent sites). */
export function MenubarSub(props: ComponentProps<typeof MenubarPrimitive.Sub>) {
  return <MenubarPrimitive.Sub data-slot="menubar-sub" {...props} />;
}

/** The item that opens a submenu. */
export function MenubarSubTrigger({
  className,
  children,
  ...props
}: ComponentProps<typeof MenubarPrimitive.SubTrigger>) {
  return (
    <MenubarPrimitive.SubTrigger
      data-slot="menubar-sub-trigger"
      className={cn(menuStyles.item, menuStyles.subTrigger, className)}
      {...props}
    >
      {children}
      <ChevronRightIcon className="ml-auto" />
    </MenubarPrimitive.SubTrigger>
  );
}

/** The open submenu. */
export function MenubarSubContent({
  className,
  ...props
}: ComponentProps<typeof MenubarPrimitive.SubContent>) {
  return (
    <MenubarPrimitive.Portal>
      <MenubarPrimitive.SubContent
        data-slot="menubar-sub-content"
        className={cn(menuStyles.content, className)}
        {...props}
      />
    </MenubarPrimitive.Portal>
  );
}
