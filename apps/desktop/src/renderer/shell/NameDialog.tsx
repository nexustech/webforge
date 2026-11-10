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
  /**
   * A switch under the name, shown while `shown` says for the name typed: a page's _Keep the old
   * address working_ when renaming it (#862). Its value goes to `onSubmit`.
   */
  readonly option?: {
    readonly label: string;
    readonly help?: (value: string) => string;
    readonly initial: boolean;
    readonly shown: (value: string) => boolean;
  };
  /** Called with the trimmed name, never an empty one, and the switch's value (false without one). */
  readonly onSubmit: (value: string, option: boolean) => void;
  readonly onCancel: () => void;
};

type NameValues = { readonly name: string; readonly option: boolean };

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
  option,
  onSubmit,
  onCancel,
}: NameDialogProps) {
  const schema = z.object({ name: z.string().trim().min(1).max(maxLength), option: z.boolean() });
  const spec: FormSpec<NameValues, NameValues> = {
    fields: ({ name }) => {
      const typed = name.trim();
      const shown = option !== undefined && typed !== "" && option.shown(typed);
      return [
        {
          kind: "text",
          name: "name",
          label,
          maxLength,
          ...(describe === undefined || typed === "" ? {} : { help: describe(typed) }),
        },
        ...(shown
          ? [
              {
                kind: "toggle" as const,
                name: "option",
                label: option.label,
                ...(option.help === undefined ? {} : { help: option.help(typed) }),
              },
            ]
          : []),
      ];
    },
    schema,
    // The switch counts only while it's shown.
    toModel: ({ name, option: on }) => ({
      name: name.trim(),
      option: on && option !== undefined && option.shown(name.trim()),
    }),
    check: ({ name }) => {
      const typed = name.trim();
      const issue = typed === "" ? undefined : problem?.(typed);
      return issue === undefined ? [] : [{ path: ["name"], message: issue }];
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
      initial={{ name: initialValue, option: option?.initial ?? false }}
      onSave={(values) => onSubmit(values.name, values.option)}
      onCancel={onCancel}
    />
  );
}
