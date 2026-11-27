import { t } from "@webforge/i18n";
import { XIcon } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "../../lib/cn.js";
import { useReturnFocus } from "./return-focus.js";

/**
 * Overlay and panel classes shared with AlertDialog. The panel is centred across the window and
 * hangs from its top edge, a little below the title bar (`--dialog-top`, theme.css), so a change of
 * its height moves only its bottom edge and nothing jumps under the pointer (#1441). It's no taller
 * than the room below that (`--dialog-fit-height`), so the window's own controls are never over it
 * (#1411); a taller one scrolls, its rows kept at their own height rather than squashed (a
 * template's preview over its caption). A dialog with a fixed height sets it as `--dialog-height`
 * (`[--dialog-height:min(44rem,var(--dialog-max-height))] h-(--dialog-height)`), and rises as far
 * as it must to fit, up to 1rem under the title bar. One that sets a height without it is only
 * shortened to fit.
 */
export const dialogStyles = {
  overlay:
    "fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
  content:
    "fixed top-[min(var(--dialog-top),calc(100dvh-1rem-var(--dialog-height,0px)))] left-1/2 z-50 grid max-h-[max(var(--dialog-fit-height),var(--dialog-height,0px))] auto-rows-max w-full max-w-[calc(100%-2rem)] -translate-x-1/2 gap-3 overflow-y-auto rounded-lg border border-border-strong bg-card p-4 text-card-foreground shadow-xl outline-none sm:max-w-md data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
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

/**
 * The dialog panel, over a dimmed backdrop, with a close button unless `showClose` is false. It
 * gives the focus back to what had it when it opened ({@link useReturnFocus}).
 */
export function DialogContent({
  className,
  children,
  showClose = true,
  onOpenAutoFocus,
  onCloseAutoFocus,
  ...props
}: ComponentProps<typeof DialogPrimitive.Content> & { readonly showClose?: boolean }) {
  const returnFocus = useReturnFocus({ onOpenAutoFocus, onCloseAutoFocus });
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay data-slot="dialog-overlay" className={dialogStyles.overlay} />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(dialogStyles.content, className)}
        {...props}
        {...returnFocus}
      >
        {children}
        {showClose && (
          <DialogPrimitive.Close
            className="absolute top-2 right-2 inline-flex size-7 items-center justify-center rounded-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring [&_svg]:size-4"
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
