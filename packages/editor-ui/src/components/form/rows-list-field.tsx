import { t } from "@webforge/i18n";
import { PlusIcon, XIcon } from "lucide-react";
import { cn } from "../../lib/cn.js";
import { drawField, useFieldRenderers } from "../edit/field-context.js";
import type {
  FieldRendererProps,
  FieldRenderers,
  ListItem,
  ListItemFieldSpec,
} from "../edit/field-spec.js";
import { PLAIN_RENDERERS } from "../edit/plain-renderers.js";
import { describedBy } from "../edit/text-field.js";
import { Button } from "../ui/button.js";
import { ErrorText } from "./form.js";

/** How wide an item's field is in its row, by kind: an address takes what's left. */
const ROW_WIDTH: Partial<Record<ListItemFieldSpec["kind"], string>> = {
  text: "min-w-40 flex-1",
  select: "w-32",
  multiChoice: "basis-full",
};

/**
 * A form's list drawn as rows (`look: "rows"`, 2.21): each item its fields side by side, with a
 * button that removes it and its problems under it, then a button that adds one, as Site Settings
 * draw social profiles and opening hours. Each change is a {@link ListChange}, as the Edit panel's
 * lists report.
 */
export function RowsListField({
  id,
  labelId,
  helpId,
  errorId,
  disabled = false,
  field,
  value,
  onChange,
  onCommit,
  itemErrors,
}: FieldRendererProps<"list">) {
  const renderers: FieldRenderers = { ...PLAIN_RENDERERS, ...useFieldRenderers() };
  const items = Array.isArray(value) ? (value as readonly ListItem[]) : [];
  const item = field.itemLabel;
  const remove = field.removeLabel ?? t("editPanel.list.delete", { item });
  const report = (change: Parameters<typeof onChange>[0]) => {
    onChange(change);
    onCommit();
  };
  return (
    <fieldset
      aria-labelledby={labelId}
      aria-describedby={describedBy(errorId, helpId)}
      className="m-0 grid gap-2 border-0 p-0"
    >
      {items.map((entry) => {
        const errors = itemErrors?.[entry.id] ?? {};
        const controlId = (name: string) => `${id}-${entry.id}-${name}`;
        return (
          <div key={entry.id} className="grid gap-1">
            <div className="flex flex-wrap items-center gap-1.5">
              {field.itemFields.map((each) => {
                const problem = errors[each.name];
                return (
                  <div
                    key={each.name}
                    className={cn("flex items-center gap-1.5", ROW_WIDTH[each.kind])}
                  >
                    <label
                      id={`${controlId(each.name)}-label`}
                      htmlFor={controlId(each.name)}
                      className={
                        each.labelBeside === true ? "text-xs text-muted-foreground" : "sr-only"
                      }
                    >
                      {each.label}
                    </label>
                    {drawField(renderers, each.kind, {
                      id: controlId(each.name),
                      labelId: `${controlId(each.name)}-label`,
                      ...(problem === undefined
                        ? {}
                        : { errorId: `${controlId(each.name)}-error` }),
                      disabled,
                      field: each,
                      value: entry[each.name],
                      onChange: (next) =>
                        onChange({ type: "edit", id: entry.id, name: each.name, value: next }),
                      onCommit,
                    } as FieldRendererProps)}
                  </div>
                );
              })}
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="ml-auto"
                aria-label={remove}
                title={remove}
                disabled={disabled}
                onClick={() => report({ type: "remove", id: entry.id })}
              >
                <XIcon />
              </Button>
            </div>
            {field.itemFields.map((each) => (
              <ErrorText
                key={each.name}
                id={`${controlId(each.name)}-error`}
                message={errors[each.name]}
              />
            ))}
          </div>
        );
      })}
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="justify-self-start"
        disabled={disabled}
        onClick={() => report({ type: "add" })}
      >
        <PlusIcon />
        {field.addLabel ?? t("editPanel.list.add", { item })}
      </Button>
    </fieldset>
  );
}
