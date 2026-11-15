import type { ComponentProps } from "react";
import { Toaster as Sonner } from "sonner";

/**
 * A toast's `className` whose button is quiet, as a secondary button is: a long task's Cancel,
 * where a filled button would be the only thing that stands out (#1014).
 */
export const QUIET_ACTION_TOAST = "toast-quiet-action";

/**
 * Where toasts appear (Undo toasts, "Site exported"). Pass the editor theme; Sonner styles the
 * toasts from the theme tokens. Show a toast with `toast()` from this package.
 */
export function Toaster({ theme = "dark", ...props }: ComponentProps<typeof Sonner>) {
  return (
    <Sonner
      theme={theme}
      position="bottom-center"
      className="toaster group"
      toastOptions={{
        classNames: {
          toast: "rounded-md! border-border-strong! bg-popover! text-popover-foreground! text-sm!",
          description: "text-muted-foreground!",
          // In a toast marked QUIET_ACTION_TOAST, the secondary colours: by a more specific rule,
          // not by which comes later in the stylesheet.
          actionButton:
            "bg-primary! text-primary-foreground! [.toast-quiet-action_&]:bg-secondary! [.toast-quiet-action_&]:text-secondary-foreground!",
          cancelButton: "bg-secondary! text-secondary-foreground!",
        },
      }}
      {...props}
    />
  );
}

export { toast } from "sonner";
