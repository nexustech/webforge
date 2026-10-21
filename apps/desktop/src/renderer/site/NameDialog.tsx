import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@webforge/editor-ui";
import { t } from "@webforge/i18n";
import { useId, useState } from "react";

/** Props of {@link NameDialog}. */
export type NameDialogProps = {
  readonly open: boolean;
  readonly title: string;
  readonly description?: string;
  /** The field's label ("Page name"). */
  readonly label: string;
  /** The field's value each time the dialog opens. */
  readonly initialValue: string;
  /** The confirm button ("Add Page", "Rename"). */
  readonly confirm: string;
  /** A line under the field, updated as the person types: the file name the page will get. */
  readonly describe: (value: string) => string;
  /** Called with the trimmed name; never with an empty one. */
  readonly onSubmit: (value: string) => void;
  readonly onCancel: () => void;
};

/** Asks for a name: a page's when adding or renaming it, a folder's when moving a page into one. */
export function NameDialog({ open, onCancel, ...form }: NameDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onCancel();
      }}
    >
      {/* The content mounts with each opening, so the form starts from `initialValue` every time. */}
      <DialogContent>
        <NameForm {...form} onCancel={onCancel} />
      </DialogContent>
    </Dialog>
  );
}

function NameForm({
  title,
  description,
  label,
  initialValue,
  confirm,
  describe,
  onSubmit,
  onCancel,
}: Omit<NameDialogProps, "open">) {
  const [value, setValue] = useState(initialValue);
  const fieldId = useId();
  const hintId = useId();
  const name = value.trim();
  return (
    <form
      className="grid gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (name !== "") {
          onSubmit(name);
        }
      }}
    >
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        {description !== undefined && <DialogDescription>{description}</DialogDescription>}
      </DialogHeader>
      <div className="grid gap-1">
        <label htmlFor={fieldId} className="text-xs text-muted-foreground">
          {label}
        </label>
        <input
          id={fieldId}
          value={value}
          maxLength={200}
          // biome-ignore lint/a11y/noAutofocus: the dialog exists to type this name.
          autoFocus
          onFocus={(event) => event.currentTarget.select()}
          onChange={(event) => setValue(event.currentTarget.value)}
          aria-describedby={hintId}
          className="h-7 w-full rounded-md border border-border bg-input px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <p id={hintId} className="text-xs text-muted-foreground">
          {name === "" ? " " : describe(name)}
        </p>
      </div>
      <DialogFooter>
        <Button type="button" variant="secondary" onClick={onCancel}>
          {t("pages.cancel")}
        </Button>
        <Button type="submit" disabled={name === ""}>
          {confirm}
        </Button>
      </DialogFooter>
    </form>
  );
}
