/**
 * Class names shared by the three menu families (DropdownMenu, ContextMenu, Menubar), so app
 * menus, split buttons and right-click menus look the same. Compact: 24 px rows, 12–13 px text.
 */
export const menuStyles = {
  content:
    "z-50 min-w-40 overflow-hidden rounded-md border border-border-strong bg-popover p-1 text-popover-foreground shadow-lg data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
  item: "relative flex h-6 cursor-default select-none items-center gap-2 rounded-sm px-2 text-sm outline-none data-[disabled]:pointer-events-none data-[disabled]:text-disabled data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground data-[variant=destructive]:text-destructive-foreground data-[variant=destructive]:data-[highlighted]:bg-destructive [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  inset: "pl-7",
  indicatorItem: "pl-7",
  indicator: "pointer-events-none absolute left-2 flex size-4 items-center justify-center",
  label: "flex h-6 items-center px-2 text-xs font-medium text-muted-foreground",
  separator: "-mx-1 my-1 h-px bg-border",
  shortcut: "ml-auto pl-4 text-xs tracking-wide text-muted-foreground",
  subTrigger: "data-[state=open]:bg-accent data-[state=open]:text-accent-foreground",
} as const;
