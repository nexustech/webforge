import type { ComponentProps } from "react";
import { Group, Panel, Separator } from "react-resizable-panels";
import { cn } from "../../lib/cn.js";

/** A row or column of resizable panels (UI1 panel columns and drawers). */
export function ResizablePanelGroup({ className, ...props }: ComponentProps<typeof Group>) {
  return (
    <Group
      data-slot="resizable-panel-group"
      className={cn("flex h-full w-full aria-[orientation=vertical]:flex-col", className)}
      {...props}
    />
  );
}

/** One panel of a {@link ResizablePanelGroup}. */
export function ResizablePanel(props: ComponentProps<typeof Panel>) {
  return <Panel data-slot="resizable-panel" {...props} />;
}

/** The draggable splitter between two panels; also resizable with the arrow keys. */
export function ResizableHandle({ className, ...props }: ComponentProps<typeof Separator>) {
  return (
    <Separator
      data-slot="resizable-handle"
      className={cn(
        "relative flex w-px items-center justify-center bg-border-strong outline-none",
        "after:absolute after:inset-y-0 after:left-1/2 after:w-1 after:-translate-x-1/2",
        "hover:bg-ring focus-visible:bg-ring data-[separator=active]:bg-ring",
        "aria-[orientation=horizontal]:h-px aria-[orientation=horizontal]:w-full",
        "aria-[orientation=horizontal]:after:left-0 aria-[orientation=horizontal]:after:h-1",
        "aria-[orientation=horizontal]:after:w-full aria-[orientation=horizontal]:after:translate-x-0",
        "aria-[orientation=horizontal]:after:-translate-y-1/2",
        className,
      )}
      {...props}
    />
  );
}
