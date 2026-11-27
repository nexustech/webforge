import { t } from "@webforge/i18n";
import { XIcon } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import {
  type ComponentProps,
  createContext,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { cn } from "../../lib/cn.js";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./alert-dialog.js";
import { Button } from "./button.js";
import { dialogStyles } from "./dialog-styles.js";
import { useReturnFocus } from "./return-focus.js";

export { dialogStyles };

/**
 * What a dialog's content tells its {@link Dialog}: whether something in it has changed (#1439).
 * Each part that reports does so under its own key, so one part with nothing changed doesn't hide
 * another's changes.
 */
type Unsaved = {
  readonly report: (key: symbol, changed: boolean) => void;
  /** Whether some part has changes now, read as the dialog would close. */
  readonly changed: () => boolean;
};

const UnsavedContext = createContext<Unsaved | null>(null);

/**
 * Says whether the dialog this is drawn in has changes that closing would throw away (#1439,
 * MVP §7 item 66). While it has, a click outside doesn't close the dialog, and Esc or its X asks
 * "Discard your changes?" first; with none, all three close it at once, as in a dialog that never
 * calls this. Its own Cancel, Save, and anything else that sets `open` itself, close it without
 * asking. For a dialog whose `open` is controlled.
 */
export function useUnsavedChanges(changed: boolean): void {
  const unsaved = useContext(UnsavedContext);
  const [key] = useState(() => Symbol("unsaved"));
  // Before the browser paints, so a key pressed straight after a change already sees it.
  useLayoutEffect(() => {
    unsaved?.report(key, changed);
    return () => unsaved?.report(key, false);
  }, [unsaved, key, changed]);
}

/**
 * {@link useUnsavedChanges} as an element, for a dialog whose state lives above its `Dialog`:
 * drawn anywhere in its content.
 */
export function UnsavedChanges({ changed }: { readonly changed: boolean }) {
  useUnsavedChanges(changed);
  return null;
}

/**
 * A modal dialog (Page Settings, Site Settings). One whose content has changes
 * ({@link useUnsavedChanges}) asks before Esc or its X throws them away.
 */
export function Dialog({
  onOpenChange,
  children,
  ...props
}: ComponentProps<typeof DialogPrimitive.Root>) {
  // The parts with changes. A ref, not state: read as the dialog would close, it holds the latest
  // reports, not the last render's.
  const changed = useRef(new Set<symbol>());
  const [asking, setAsking] = useState(false);
  const discarded = useRef(false);
  const unsaved = useMemo<Unsaved>(
    () => ({
      report: (key, next) => {
        if (next) changed.current.add(key);
        else changed.current.delete(key);
      },
      changed: () => changed.current.size > 0,
    }),
    [],
  );
  return (
    <UnsavedContext.Provider value={unsaved}>
      <DialogPrimitive.Root
        data-slot="dialog"
        {...props}
        onOpenChange={(next) => {
          if (!next && unsaved.changed()) {
            setAsking(true);
            return;
          }
          onOpenChange?.(next);
        }}
      >
        {children}
      </DialogPrimitive.Root>
      <AlertDialog
        open={asking}
        onOpenChange={(next) => {
          // Esc on the question keeps editing.
          if (!next) setAsking(false);
        }}
      >
        <AlertDialogContent
          // Discarded, the focus goes back with the dialog, to what opened it; kept editing, to the
          // field the question was asked from.
          onCloseAutoFocus={(event) => {
            if (!discarded.current) return;
            discarded.current = false;
            event.preventDefault();
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>{t("ui.unsaved.title")}</AlertDialogTitle>
            <AlertDialogDescription>{t("ui.unsaved.description")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            {/* The safe choice first, with the focus, as Theme Studio's question had it (4.10). */}
            <AlertDialogCancel>{t("ui.unsaved.keepEditing")}</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                discarded.current = true;
                setAsking(false);
                // Straight to the dialog's own close: its changes stay counted, so a dialog that
                // stays open (busy applying) still asks the next time.
                onOpenChange?.(false);
              }}
            >
              {t("ui.unsaved.discard")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </UnsavedContext.Provider>
  );
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
  onInteractOutside,
  ...props
}: ComponentProps<typeof DialogPrimitive.Content> & { readonly showClose?: boolean }) {
  const returnFocus = useReturnFocus({ onOpenAutoFocus, onCloseAutoFocus });
  const unsaved = useContext(UnsavedContext);
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay data-slot="dialog-overlay" className={dialogStyles.overlay} />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(dialogStyles.content, className)}
        {...props}
        {...returnFocus}
        onInteractOutside={(event) => {
          onInteractOutside?.(event);
          // With changes, the largest target on screen doesn't throw them away (#1439).
          if (unsaved?.changed() === true) event.preventDefault();
        }}
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
