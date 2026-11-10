import { FormDialog, type FormSpec } from "@webforge/editor-ui";
import { t } from "@webforge/i18n";
import { NOTE_MAX } from "@webforge/model";
import { z } from "zod";
import "../shell/form-messages.js";

/** Props of {@link NoteDialog}. */
export type NoteDialogProps = {
  readonly open: boolean;
  /** What the note is on, as undo labels name it ("Heading", "'Opening times'"). */
  readonly item: string;
  /** The note it has now; empty when it has none. */
  readonly note: string;
  /** Called with the note as typed: an empty one resolves it. */
  readonly onSave: (note: string) => void;
  readonly onCancel: () => void;
};

type NoteValues = { readonly note: string };

/**
 * A note on an element (UX-17, #868): only for the person, never exported. Saving an emptied note
 * resolves it, as *Resolve Note* does.
 */
export function NoteDialog({ open, item, note, onSave, onCancel }: NoteDialogProps) {
  const spec: FormSpec<NoteValues, string> = {
    fields: () => [
      {
        kind: "text",
        name: "note",
        path: "",
        label: t("notes.field"),
        multiline: true,
        maxLength: NOTE_MAX,
        placeholder: t("notes.placeholder"),
        help: t("notes.help"),
      },
    ],
    schema: z.string().max(NOTE_MAX),
    toModel: ({ note: typed }) => typed,
  };
  return (
    <FormDialog
      open={open}
      title={t("notes.title", { item })}
      description={t("notes.description")}
      confirm={t("notes.save")}
      spec={spec}
      initial={{ note }}
      onSave={(typed) => onSave(typed)}
      onCancel={onCancel}
    />
  );
}
