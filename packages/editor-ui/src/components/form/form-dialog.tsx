import { t } from "@webforge/i18n";
import { type ReactNode, useEffect, useState } from "react";
import { cn } from "../../lib/cn.js";
import { Button } from "../ui/button.js";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog.js";
import { Form } from "./form-engine.js";
import type { FormSpec, FormValues } from "./form-spec.js";
import { useForm } from "./use-form.js";

/** Props of {@link FormDialog}. */
export type FormDialogProps<V extends FormValues, Out> = {
  readonly open: boolean;
  readonly title: string;
  /** What the dialog is for, read out with the title; already translated. */
  readonly description?: string;
  /** The button that saves ("Save", "Add Page"); already translated. */
  readonly confirm: string;
  readonly spec: FormSpec<V, Out>;
  /** The values it starts from, each time it opens. */
  readonly initial: V;
  /** What its tabs are, for screen readers; for a form with groups. */
  readonly groupsLabel?: string;
  /** The tab it opens on; its first when left out. */
  readonly initialGroup?: string;
  /** Wide, for a form with tabs (Site Settings); the dialogs' width otherwise. */
  readonly size?: "md" | "lg" | "xl";
  /** Beside the close button: a **?** for the dialog (5.4b). */
  readonly help?: ReactNode;
  /** At the top of a group's tab: a **?** for that section (5.4b). */
  readonly groupHelp?: (group: string) => ReactNode;
  /**
   * Whether its fields keep the most room they've taken while it's open, so a choice that shows
   * fewer fields (a link's type) doesn't shorten the dialog and move its buttons (#1441). A choice
   * that shows more still grows it, downward.
   */
  readonly keepHeight?: boolean;
  /**
   * Saving: the checked value, and the groups whose fields changed, for the one undo step the
   * app records ("Changed Site Settings: Contact & hours"). The dialog doesn't close by itself.
   */
  readonly onSave: (output: Out, changed: { readonly groups: readonly string[] }) => void;
  readonly onCancel: () => void;
};

/**
 * A dialog of one form (2.21, B4): its title, the form's fields (`Form`), and Cancel and the
 * confirm button. Enter saves. A form that checks as the person types (`validateOn: "change"`)
 * keeps Save off until its values pass; others show what to fix when Save is pressed. Dialogs
 * declare a {@link FormSpec} instead of drawing their own fields. In a window too short for the
 * whole form, the fields scroll between the title and the buttons, which stay in view (#1172).
 * With a side nav (`size="xl"`, Settings) it keeps one height whichever section is shown, no
 * taller than the window allows, and only the section's fields scroll (#1409).
 */
export function FormDialog<V extends FormValues, Out>({
  open,
  size = "md",
  onCancel,
  help,
  ...body
}: FormDialogProps<V, Out>) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onCancel();
      }}
    >
      {/*
        The content mounts with each opening, so the form starts from `initial` every time. It
        focuses the first field with its text selected, so typing replaces it (renaming).
      */}
      <DialogContent
        className={cn(
          // A column, so the form can shrink to the window and scroll its fields (#1172).
          "flex flex-col",
          size === "lg" && "sm:max-w-2xl",
          // A form with a side nav (LF-12's Settings): one height for every section (#1409).
          size === "xl" &&
            "[--dialog-height:min(44rem,var(--dialog-max-height))] h-(--dialog-height) sm:max-w-3xl",
        )}
      >
        <FormDialogBody {...body} onCancel={onCancel} />
        {/* Last, so the dialog's first field still takes the focus as it opens. */}
        {help === undefined ? null : <div className="absolute top-2.5 right-9">{help}</div>}
      </DialogContent>
    </Dialog>
  );
}

/**
 * The tallest the element given to its ref has been since it mounted, as its `min-height`, for
 * {@link FormDialogProps.keepHeight}: none when `keep` is false, and none again after the window is
 * resized, where what fits changes.
 */
function useKeptHeight(keep: boolean) {
  // A callback ref, kept as state: the element to watch, once it's drawn.
  const [element, ref] = useState<HTMLDivElement | null>(null);
  const [height, setHeight] = useState<number | undefined>(undefined);
  useEffect(() => {
    const view = element?.ownerDocument.defaultView;
    if (!keep || element === null || view === null || view === undefined) return undefined;
    const observer = new view.ResizeObserver((entries) => {
      // Its laid-out height, not as drawn: the dialog opens zoomed to 95%, which a bounding box
      // would keep, and its end changes no size to report the real one.
      const now = entries[0]?.borderBoxSize[0]?.blockSize ?? element.offsetHeight;
      setHeight((kept) => (kept === undefined || now > kept ? now : kept));
    });
    observer.observe(element);
    const forget = () => setHeight(undefined);
    view.addEventListener("resize", forget);
    return () => {
      observer.disconnect();
      view.removeEventListener("resize", forget);
    };
  }, [keep, element]);
  return [ref, height === undefined ? undefined : { minHeight: height }] as const;
}

function FormDialogBody<V extends FormValues, Out>({
  title,
  description,
  confirm,
  spec,
  initial,
  groupsLabel,
  initialGroup,
  groupHelp,
  keepHeight = false,
  onSave,
  onCancel,
}: Omit<FormDialogProps<V, Out>, "open" | "size" | "help">) {
  const form = useForm(spec, initial);
  const [keptRef, keptStyle] = useKeptHeight(keepHeight);
  // Whether Save was tried: a check the form's own content ran (Test Connection) isn't a save.
  const [saveTried, setSaveTried] = useState(false);
  return (
    <form
      className="flex min-h-0 flex-1 flex-col gap-3"
      // What to fix shows in the editor's own words, never the browser's bubble.
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        setSaveTried(true);
        const saved = form.submit();
        if (saved.ok) onSave(saved.output, { groups: saved.changedGroups });
      }}
    >
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        {description === undefined ? null : <DialogDescription>{description}</DialogDescription>}
      </DialogHeader>
      {/*
        The fields scroll; the title and the buttons don't (#1172). It reaches the dialog's edges,
        so its scroll bar is at the edge and a field's focus ring isn't cut off. A form with a side
        nav fills it, and scrolls its section's fields itself, the nav staying put (#1409).
      */}
      <div
        // Positioned, so what's positioned in its fields is held here, not by the `fixed` dialog,
        // which would scroll itself too (#1437).
        data-slot="form-fields"
        ref={keptRef}
        style={keptStyle}
        className="relative -mx-4 -my-1 flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-1"
      >
        <Form
          form={form}
          {...(groupsLabel === undefined ? {} : { groupsLabel })}
          {...(initialGroup === undefined ? {} : { initialGroup })}
          {...(groupHelp === undefined ? {} : { groupHelp })}
        />
      </div>
      <DialogFooter>
        {/*
          After a Save that couldn't: why nothing happened, read out at once. Beside the buttons,
          not above them, so it moves nothing under the pointer (#1441).
        */}
        {saveTried && form.issues.length > 0 ? (
          <p role="alert" className="m-0 min-w-0 flex-1 self-center text-xs text-destructive-text">
            {t("ui.form.fixErrors")}
          </p>
        ) : null}
        <Button type="button" variant="secondary" onClick={onCancel}>
          {t("ui.form.cancel")}
        </Button>
        <Button type="submit" disabled={spec.validateOn === "change" && !form.valid}>
          {confirm}
        </Button>
      </DialogFooter>
    </form>
  );
}
