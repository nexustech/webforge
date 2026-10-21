import { t } from "@webforge/i18n";
import { ArrowDownIcon, ArrowUpIcon, ChevronRightIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { cn } from "../../lib/cn.js";
import { Button } from "../ui/button.js";
import type {
  FieldRendererProps,
  ListChange,
  ListItemFieldSpec,
  ListItemValue,
} from "./field-registry.js";
import { plainRenderer } from "./plain-renderers.js";

/** The items of a list's value; anything else is an empty list. */
function itemsOf(value: unknown): readonly ListItemValue[] {
  return Array.isArray(value) ? (value as ListItemValue[]) : [];
}

/** What an item's row shows: its first text, as the user wrote it. */
function summaryOf(item: ListItemValue, fields: readonly ListItemFieldSpec[]): string {
  for (const field of fields) {
    const value = item.values[field.name];
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

/** Which item shows its fields: one by key, or the one Add is about to create (at its index). */
type Open = { readonly key: string } | { readonly added: number } | null;

/**
 * A repeating list (F-ED-6): a row per item with move up, move down and delete, the open item's
 * fields below its row, and Add at the end. Each action is one {@link ListChange}; so is a change
 * to an item's field, whose run of changes (typing) ends with `onCommit` as the field ends it.
 */
export function ListField({ id, labelId, field, value, onChange, onCommit }: FieldRendererProps) {
  const items = itemsOf(value);
  const item = field.itemLabel ?? "";
  const fields = field.itemFields ?? [];
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
              ("key" in open
                ? open.key === entry.key
                : open.added === index && items.length === index + 1);
            const summary =
              summaryOf(entry, fields) || t("editPanel.list.untitled", { item, number: index + 1 });
            const contentId = `${id}-${entry.key}`;
            return (
              <li key={entry.key} className="rounded-sm border border-border">
                <div className="flex items-center gap-0.5 pr-0.5">
                  <button
                    type="button"
                    data-list-row={entry.key}
                    aria-expanded={expanded}
                    aria-controls={expanded ? contentId : undefined}
                    className={cn(
                      "flex min-w-0 flex-1 items-center gap-1 rounded-sm px-1.5 py-1 text-left text-xs",
                      "outline-none hover:bg-hover focus-visible:ring-2 focus-visible:ring-ring",
                    )}
                    onClick={() => setOpen(expanded ? null : { key: entry.key })}
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
                  <RowAction
                    label={t("editPanel.list.moveUp", { item })}
                    disabled={index === 0}
                    onClick={() => change({ type: "move", key: entry.key, to: index - 1 })}
                  >
                    <ArrowUpIcon className="size-3.5" />
                  </RowAction>
                  <RowAction
                    label={t("editPanel.list.moveDown", { item })}
                    disabled={index === items.length - 1}
                    onClick={() => change({ type: "move", key: entry.key, to: index + 1 })}
                  >
                    <ArrowDownIcon className="size-3.5" />
                  </RowAction>
                  <RowAction
                    label={t("editPanel.list.delete", { item })}
                    onClick={() => {
                      const next = items[index + 1] ?? items[index - 1];
                      setFocusAfterDelete(next?.key ?? "");
                      change({ type: "remove", key: entry.key });
                    }}
                  >
                    <Trash2Icon className="size-3.5" />
                  </RowAction>
                </div>
                {expanded ? (
                  <div id={contentId} className="flex flex-col gap-2 px-2 pt-1 pb-2">
                    {fields.map((sub) => {
                      const Renderer = plainRenderer(sub.kind);
                      if (Renderer === undefined) {
                        return null;
                      }
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
                          <Renderer
                            id={subId}
                            labelId={`${subId}-label`}
                            field={sub}
                            value={entry.values[sub.name]}
                            onChange={(next) =>
                              change({ type: "edit", key: entry.key, name: sub.name, value: next })
                            }
                            onCommit={onCommit}
                          />
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
