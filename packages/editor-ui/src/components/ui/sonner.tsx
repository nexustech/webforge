import type { ComponentProps } from "react";
import { Toaster as Sonner } from "sonner";

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
          actionButton: "bg-primary! text-primary-foreground!",
          cancelButton: "bg-secondary! text-secondary-foreground!",
        },
      }}
      {...props}
    />
  );
}

export { toast } from "sonner";
