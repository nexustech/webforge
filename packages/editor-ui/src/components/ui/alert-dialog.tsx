import { AlertDialog as AlertDialogPrimitive } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "../../lib/cn.js";
import { buttonVariants } from "./button.js";
import { dialogStyles } from "./dialog.js";
import { useReturnFocus } from "./return-focus.js";

/** A confirmation that needs an answer (D5/D7: "Delete page 'About'?"). */
export function AlertDialog(props: ComponentProps<typeof AlertDialogPrimitive.Root>) {
  return <AlertDialogPrimitive.Root data-slot="alert-dialog" {...props} />;
}

/** The button that opens the confirmation. */
export function AlertDialogTrigger(props: ComponentProps<typeof AlertDialogPrimitive.Trigger>) {
  return <AlertDialogPrimitive.Trigger data-slot="alert-dialog-trigger" {...props} />;
}

/**
 * The confirmation panel. It has no close button: the person picks an action or presses Esc. It
 * gives the focus back to what had it when it opened ({@link useReturnFocus}).
 */
export function AlertDialogContent({
  className,
  onOpenAutoFocus,
  onCloseAutoFocus,
  ...props
}: ComponentProps<typeof AlertDialogPrimitive.Content>) {
  const returnFocus = useReturnFocus({ onOpenAutoFocus, onCloseAutoFocus });
  return (
    <AlertDialogPrimitive.Portal>
      <AlertDialogPrimitive.Overlay
        data-slot="alert-dialog-overlay"
        className={dialogStyles.overlay}
      />
      <AlertDialogPrimitive.Content
        data-slot="alert-dialog-content"
        className={cn(dialogStyles.content, className)}
        {...props}
        {...returnFocus}
      />
    </AlertDialogPrimitive.Portal>
  );
}

/** Title and description at the top. */
export function AlertDialogHeader({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-dialog-header"
      className={cn(dialogStyles.header, className)}
      {...props}
    />
  );
}

/** Cancel and the action; the action goes last. */
export function AlertDialogFooter({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-dialog-footer"
      className={cn(dialogStyles.footer, className)}
      {...props}
    />
  );
}

/** The question being asked. */
export function AlertDialogTitle({
  className,
  ...props
}: ComponentProps<typeof AlertDialogPrimitive.Title>) {
  return (
    <AlertDialogPrimitive.Title
      data-slot="alert-dialog-title"
      className={cn(dialogStyles.title, className)}
      {...props}
    />
  );
}

/** What happens if the person confirms, and whether it can be undone. */
export function AlertDialogDescription({
  className,
  ...props
}: ComponentProps<typeof AlertDialogPrimitive.Description>) {
  return (
    <AlertDialogPrimitive.Description
      data-slot="alert-dialog-description"
      className={cn(dialogStyles.description, className)}
      {...props}
    />
  );
}

/** Confirms. `variant="destructive"` for Delete. */
export function AlertDialogAction({
  className,
  variant = "default",
  ...props
}: ComponentProps<typeof AlertDialogPrimitive.Action> & {
  readonly variant?: "default" | "destructive";
}) {
  return (
    <AlertDialogPrimitive.Action
      data-slot="alert-dialog-action"
      className={cn(buttonVariants({ variant }), className)}
      {...props}
    />
  );
}

/** Closes without doing anything; focused first, so Enter never confirms by accident. */
export function AlertDialogCancel({
  className,
  ...props
}: ComponentProps<typeof AlertDialogPrimitive.Cancel>) {
  return (
    <AlertDialogPrimitive.Cancel
      data-slot="alert-dialog-cancel"
      className={cn(buttonVariants({ variant: "outline" }), className)}
      {...props}
    />
  );
}
