import { t } from "@webforge/i18n";
import { ArrowDownIcon, ArrowUpIcon, ChevronRightIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { cn } from "../../lib/cn.js";
import { Button } from "../ui/button.js";
import { drawField, useFieldRenderers } from "./field-context.js";
import type {
  FieldRendererProps,
  FieldRenderers,
  ListChange,
  ListItem,
  ListItemFieldSpec,
} from "./field-spec.js";
import { PLAIN_RENDERERS } from "./plain-renderers.js";
import { describedBy } from "./text-field.js";

/** The items of a list's value; anything else is an empty list. */
function itemsOf(value: unknown): readonly ListItem[] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is ListItem =>
          typeof item === "object" && item !== null && typeof item.id === "string",
      )
    : [];
}

/** What an item's row shows: its first text, as the user wrote it. */
function summaryOf(item: ListItem, fields: readonly ListItemFieldSpec[]): string {
  for (const field of fields) {
    const value = item[field.name];
    if (field.kind === "text" && typeof value === "string" && value.trim() !== "") {
      return value.trim();
    }
  }
  return "";
}

function RowAction({
  label,
  disabled = false,
  onClick,
  children,
}: {
  readonly label: string;
  readonly disabled?: boolean;
  readonly onClick: () => void;
  readonly children: ReactNode;
}) {
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

/** Which item shows its fields: one by id, or the one Add is about to create (at its index). */
type Open = { readonly id: string } | { readonly added: number } | null;

/**
 * A repeating list (F-ED-6): a row per item with move up, move down and delete, the open item's
 * fields below its row, and Add at the end. Each action is one {@link ListChange}; so is a change
 * to an item's field, whose run of changes (typing) ends with `onCommit` as the field ends it.
 */
export function ListField({
  id,
  labelId,
  helpId,
  errorId,
  disabled = false,
  field,
  value,
  onChange,
  onCommit,
}: FieldRendererProps<"list">) {
  const items = itemsOf(value);
  const { itemLabel: item, itemFields: fields } = field;
  // The panel's renderers, over the plain ones a list drawn on its own has (R11).
  const renderers: FieldRenderers = { ...PLAIN_RENDERERS, ...useFieldRenderers() };
  const [open, setOpen] = useState<Open>(null);
  // Where focus goes once a deleted item's row (and its focused Delete button) has gone: the row
  // that took its place, else the one before, else Add.
  const [focusAfterDelete, setFocusAfterDelete] = useState<string | null>(null);
  const root = useRef<HTMLFieldSetElement>(null);
  useEffect(() => {
    if (focusAfterDelete === null) {
      return;
    }
    setFocusAfterDelete(null);
    const target =
      root.current?.querySelector<HTMLElement>(
        `[data-list-row="${CSS.escape(focusAfterDelete)}"]`,
      ) ?? root.current?.querySelector<HTMLElement>("[data-list-add]");
    target?.focus();
  }, [focusAfterDelete]);
  const change = (listChange: ListChange) => onChange(listChange);
  return (
    <fieldset
      ref={root}
      id={id}
      aria-labelledby={labelId}
      // A group can't be marked invalid; its message describes it.
      aria-describedby={describedBy(errorId, helpId)}
      className="m-0 flex min-w-0 flex-col gap-1 border-0 p-0"
    >
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t("editPanel.list.empty")}</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {items.map((entry, index) => {
            // The added item opens only as it arrives, the last of one more item than before.
            const expanded =
              open !== null &&
              ("id" in open
                ? open.id === entry.id
                : open.added === index && items.length === index + 1);
            const summary =
              summaryOf(entry, fields) || t("editPanel.list.untitled", { item, number: index + 1 });
            const contentId = `${id}-${entry.id}`;
            return (
              <li key={entry.id} className="rounded-sm border border-border">
                <div className="flex items-center gap-0.5 pr-0.5">
                  <button
                    type="button"
                    data-list-row={entry.id}
                    aria-expanded={expanded}
                    aria-controls={expanded ? contentId : undefined}
                    className={cn(
                      "flex min-w-0 flex-1 items-center gap-1 rounded-sm px-1.5 py-1 text-left text-xs",
                      "outline-none hover:bg-hover focus-visible:ring-2 focus-visible:ring-ring",
                    )}
                    onClick={() => setOpen(expanded ? null : { id: entry.id })}
                  >
                    <ChevronRightIcon
                      aria-hidden
                      className={cn(
                        "size-3 shrink-0 transition-transform",
                        expanded && "rotate-90",
                      )}
                    />
                    <span className="truncate">{summary}</span>
                  </button>
                  {field.orderless === true ? null : (
                    <>
                      <RowAction
                        label={t("editPanel.list.moveUp", { item })}
                        disabled={disabled || index === 0}
                        onClick={() => change({ type: "move", id: entry.id, to: index - 1 })}
                      >
                        <ArrowUpIcon className="size-3.5" />
                      </RowAction>
                      <RowAction
                        label={t("editPanel.list.moveDown", { item })}
                        disabled={disabled || index === items.length - 1}
                        onClick={() => change({ type: "move", id: entry.id, to: index + 1 })}
                      >
                        <ArrowDownIcon className="size-3.5" />
                      </RowAction>
                    </>
                  )}
                  <RowAction
                    label={t("editPanel.list.delete", { item })}
                    disabled={disabled}
                    onClick={() => {
                      const next = items[index + 1] ?? items[index - 1];
                      setFocusAfterDelete(next?.id ?? "");
                      change({ type: "remove", id: entry.id });
                    }}
                  >
                    <Trash2Icon className="size-3.5" />
                  </RowAction>
                </div>
                {expanded ? (
                  <div id={contentId} className="flex flex-col gap-2 px-2 pt-1 pb-2">
                    {fields.map((sub) => {
                      if (renderers[sub.kind] === undefined) return null;
                      const subId = `${contentId}-${sub.name}`;
                      return (
                        <div key={sub.name} className="flex flex-col gap-1">
                          <label
                            id={`${subId}-label`}
                            htmlFor={subId}
                            className="text-xs text-muted-foreground"
                          >
                            {sub.label}
                          </label>
                          {drawField(renderers, sub.kind, {
                            id: subId,
                            labelId: `${subId}-label`,
                            field: sub,
                            disabled,
                            value: entry[sub.name],
                            onChange: (next) =>
                              change({ type: "edit", id: entry.id, name: sub.name, value: next }),
                            onCommit,
                          })}
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
      <Button
        variant="ghost"
        size="sm"
        className="self-start"
        data-list-add
        disabled={disabled}
        onClick={() => {
          setOpen({ added: items.length });
          change({ type: "add" });
        }}
      >
        <PlusIcon className="size-3.5" />
        {t("editPanel.list.add", { item })}
      </Button>
    </fieldset>
  );
}
