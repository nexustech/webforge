import { t } from "@webforge/i18n";
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
  readonly size?: "md" | "lg";
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
 * declare a {@link FormSpec} instead of drawing their own fields.
 */
export function FormDialog<V extends FormValues, Out>({
  open,
  size = "md",
  onCancel,
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
        className={cn("max-h-[calc(100dvh-2rem)] overflow-y-auto", size === "lg" && "sm:max-w-2xl")}
      >
        <FormDialogBody {...body} onCancel={onCancel} />
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
  onSave,
  onCancel,
}: Omit<FormDialogProps<V, Out>, "open" | "size">) {
  const form = useForm(spec, initial);
  return (
    <form
      className="grid gap-3"
      // What to fix shows in the editor's own words, never the browser's bubble.
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        const saved = form.submit();
        if (saved.ok) onSave(saved.output, { groups: saved.changedGroups });
      }}
    >
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        {description === undefined ? null : <DialogDescription>{description}</DialogDescription>}
      </DialogHeader>
      <Form
        form={form}
        {...(groupsLabel === undefined ? {} : { groupsLabel })}
        {...(initialGroup === undefined ? {} : { initialGroup })}
      />
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
