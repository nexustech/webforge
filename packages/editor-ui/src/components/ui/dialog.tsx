import { t } from "@webforge/i18n";
import { XIcon } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "../../lib/cn.js";

/** Overlay and panel classes shared with AlertDialog. */
export const dialogStyles = {
  overlay:
    "fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
  content:
    "fixed top-1/2 left-1/2 z-50 grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-3 rounded-lg border border-border-strong bg-card p-4 text-card-foreground shadow-xl outline-none sm:max-w-md data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
  header: "flex flex-col gap-1",
  footer: "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
  title: "text-lg font-semibold",
  description: "text-sm text-muted-foreground",
} as const;

/** A modal dialog (Page Settings, Site Settings). */
export function Dialog(props: ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />;
}

/** The button that opens the dialog; use `asChild` around a {@link Button}. */
export function DialogTrigger(props: ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}

/** Closes the dialog; use `asChild` around a {@link Button}. */
export function DialogClose(props: ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
}

/** The dialog panel, over a dimmed backdrop, with a close button unless `showClose` is false. */
export function DialogContent({
  className,
  children,
  showClose = true,
  ...props
}: ComponentProps<typeof DialogPrimitive.Content> & { readonly showClose?: boolean }) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay data-slot="dialog-overlay" className={dialogStyles.overlay} />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(dialogStyles.content, className)}
        {...props}
      >
        {children}
        {showClose && (
          <DialogPrimitive.Close
            className="absolute top-3 right-3 rounded-sm p-0.5 text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring [&_svg]:size-4"
            aria-label={t("ui.close")}
          >
            <XIcon />
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

/** Title and description at the top of the dialog. */
export function DialogHeader({ className, ...props }: ComponentProps<"div">) {
  return (
    <div data-slot="dialog-header" className={cn(dialogStyles.header, className)} {...props} />
  );
}

/** The dialog's buttons; the main action goes last. */
export function DialogFooter({ className, ...props }: ComponentProps<"div">) {
  return (
    <div data-slot="dialog-footer" className={cn(dialogStyles.footer, className)} {...props} />
  );
}

/** The dialog's title; required for screen readers. */
export function DialogTitle({ className, ...props }: ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn(dialogStyles.title, className)}
      {...props}
    />
  );
}

/** A sentence under the title saying what the dialog is for. */
export function DialogDescription({
  className,
  ...props
}: ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn(dialogStyles.description, className)}
      {...props}
    />
  );
}
