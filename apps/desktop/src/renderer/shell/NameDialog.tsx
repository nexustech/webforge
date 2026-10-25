import { FormDialog, type FormSpec } from "@webforge/editor-ui";
import { z } from "zod";
import "./form-messages.js";

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
  readonly describe?: (value: string) => string;
  /** The longest name the field takes: the model's limit for what is named. */
  readonly maxLength: number;
  /** Why a name can't be used, if it can't: said under the field, with the confirm button off. */
  readonly problem?: (value: string) => string | undefined;
  /** Called with the trimmed name; never with an empty one. */
  readonly onSubmit: (value: string) => void;
  readonly onCancel: () => void;
};

type NameValues = { readonly name: string };

/**
 * Asks for a name: a page's when adding or renaming it, a folder's when moving a page into one, a
 * shared section's when saving one. A form (2.21): checked as the person types, against a schema
 * of the model's limit, so the editor's words say what is wrong.
 */
export function NameDialog({
  open,
  title,
  description,
  label,
  initialValue,
  confirm,
  describe,
  maxLength,
  problem,
  onSubmit,
  onCancel,
}: NameDialogProps) {
  const schema = z.string().trim().min(1).max(maxLength);
  const spec: FormSpec<NameValues, string> = {
    fields: ({ name }) => {
      const typed = name.trim();
      return [
        {
          kind: "text",
          name: "name",
          path: "",
          label,
          maxLength,
          ...(describe === undefined || typed === "" ? {} : { help: describe(typed) }),
        },
      ];
    },
    schema,
    toModel: ({ name }) => name,
    check: ({ name }) => {
      const typed = name.trim();
      const issue = typed === "" ? undefined : problem?.(typed);
      return issue === undefined ? [] : [{ path: [], message: issue }];
    },
    validateOn: "change",
  };
  return (
    <FormDialog
      open={open}
      title={title}
      {...(description === undefined ? {} : { description })}
      confirm={confirm}
      spec={spec}
      initial={{ name: initialValue }}
      onSave={(name) => onSubmit(name)}
      onCancel={onCancel}
    />
  );
}
