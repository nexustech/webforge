import { Command as CommandPrimitive } from "cmdk";
import { SearchIcon } from "lucide-react";
import type { ComponentProps } from "react";
import { cn } from "../../lib/cn.js";
import { menuStyles } from "./menu-styles.js";

/** A searchable list of commands (the title-bar command box). */
export function Command({ className, ...props }: ComponentProps<typeof CommandPrimitive>) {
  return (
    <CommandPrimitive
      data-slot="command"
      className={cn(
        "flex h-full w-full flex-col overflow-hidden rounded-md bg-popover text-popover-foreground",
        className,
      )}
      {...props}
    />
  );
}

/** The search field. */
export function CommandInput({
  className,
  ...props
}: ComponentProps<typeof CommandPrimitive.Input>) {
  return (
    <div data-slot="command-input-wrapper" className="flex h-8 items-center gap-2 border-b px-2">
      <SearchIcon className="size-4 shrink-0 text-muted-foreground" />
      <CommandPrimitive.Input
        data-slot="command-input"
        className={cn(
          "flex h-7 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:text-disabled",
          className,
        )}
        {...props}
      />
    </div>
  );
}

/** The results. */
export function CommandList({ className, ...props }: ComponentProps<typeof CommandPrimitive.List>) {
  return (
    <CommandPrimitive.List
      data-slot="command-list"
      className={cn("max-h-80 scroll-py-1 overflow-y-auto overflow-x-hidden p-1", className)}
      {...props}
    />
  );
}

/** Shown when nothing matches the search. */
export function CommandEmpty({
  className,
  ...props
}: ComponentProps<typeof CommandPrimitive.Empty>) {
  return (
    <CommandPrimitive.Empty
      data-slot="command-empty"
      className={cn("py-4 text-center text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

/** A group of results with a heading. */
export function CommandGroup({
  className,
  ...props
}: ComponentProps<typeof CommandPrimitive.Group>) {
  return (
    <CommandPrimitive.Group
      data-slot="command-group"
      className={cn(
        "overflow-hidden [&_[cmdk-group-heading]]:flex [&_[cmdk-group-heading]]:h-6 [&_[cmdk-group-heading]]:items-center [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}

/** A line between groups. */
export function CommandSeparator({
  className,
  ...props
}: ComponentProps<typeof CommandPrimitive.Separator>) {
  return (
    <CommandPrimitive.Separator
      data-slot="command-separator"
      className={cn(menuStyles.separator, className)}
      {...props}
    />
  );
}

/** One command; Enter or a click runs it. */
export function CommandItem({ className, ...props }: ComponentProps<typeof CommandPrimitive.Item>) {
  return (
    <CommandPrimitive.Item
      data-slot="command-item"
      className={cn(
        menuStyles.item,
        "data-[disabled=true]:pointer-events-none data-[disabled=true]:text-disabled data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground",
        className,
      )}
      {...props}
    />
  );
}

/** The command's keyboard shortcut. */
export function CommandShortcut({ className, ...props }: ComponentProps<"span">) {
  return (
    <span data-slot="command-shortcut" className={cn(menuStyles.shortcut, className)} {...props} />
  );
}
