import { t } from "@webforge/i18n";
import { type ReactNode, useState } from "react";
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
          size === "xl" && "h-[min(44rem,var(--dialog-max-height))] sm:max-w-3xl",
        )}
      >
        <FormDialogBody {...body} onCancel={onCancel} />
        {/* Last, so the dialog's first field still takes the focus as it opens. */}
        {help === undefined ? null : <div className="absolute top-2.5 right-9">{help}</div>}
      </DialogContent>
    </Dialog>
  );
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
  onSave,
  onCancel,
}: Omit<FormDialogProps<V, Out>, "open" | "size" | "help">) {
  const form = useForm(spec, initial);
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
      <div className="-mx-4 -my-1 flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-1">
        <Form
          form={form}
          {...(groupsLabel === undefined ? {} : { groupsLabel })}
          {...(initialGroup === undefined ? {} : { initialGroup })}
          {...(groupHelp === undefined ? {} : { groupHelp })}
        />
      </div>
      {/* After a Save that couldn't: why nothing happened, read out at once. */}
      {saveTried && form.issues.length > 0 ? (
        <p role="alert" className="m-0 text-xs text-destructive-text">
          {t("ui.form.fixErrors")}
        </p>
      ) : null}
      <DialogFooter>
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
