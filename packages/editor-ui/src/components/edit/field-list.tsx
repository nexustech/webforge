import { t } from "@webforge/i18n";
import { ChevronRightIcon, ClipboardPasteIcon, CopyIcon, RotateCcwIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../../lib/cn.js";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "../ui/context-menu.js";
import { WithTooltip } from "../ui/tooltip.js";
import type {
  EditPanelField,
  EditPanelProps,
  FieldGroup,
  OptionGroup,
} from "./edit-panel-types.js";
import { ChangedDot, FieldRow, marked, resettable } from "./field-row.js";
import type { FieldKind } from "./field-spec.js";

/** The groups of fields that name none (UX-13), by kind; each id is its translation key's. */
type FallbackGroup =
  | "advanced"
  | "image"
  | "link"
  | "items"
  | "spacing"
  | "colours"
  | "text"
  | "options";

const fallbackGroup = (id: FallbackGroup): OptionGroup => ({
  id,
  label: t(`editPanel.optionGroup.${id}`),
});

/** The option group a field is in: its own, or one by its kind (UX-13). */
function optionGroupOf(field: EditPanelField): OptionGroup {
  if (field.optionGroup !== undefined) return field.optionGroup;
  if (field.group === "advanced") return fallbackGroup("advanced");
  switch (field.kind) {
    case "image":
      return fallbackGroup("image");
    case "link":
      return fallbackGroup("link");
    case "list":
      return fallbackGroup("items");
    case "box":
    case "spacing":
      return fallbackGroup("spacing");
    case "color":
      return fallbackGroup("colours");
    case "select":
    case "slider":
    case "toggle":
      // A component's own options; "Appearance" is the group every section and element has (2.22).
      return fallbackGroup(field.group === "content" ? "text" : "options");
    default:
      return fallbackGroup("text");
  }
}

/**
 * `fields` by option group, in the order each group's first field comes. A group is known as
 * `tab:id`: each tab's groups are its own, so closing Style's Text leaves Content's open.
 */
function optionGroupsOf(tab: FieldGroup, fields: readonly EditPanelField[]) {
  const groups = new Map<string, { id: string; label: string; fields: EditPanelField[] }>();
  for (const field of fields) {
    const { id, label } = optionGroupOf(field);
    const key = `${tab}:${id}`;
    const group = groups.get(key) ?? { id, label, fields: [] };
    group.fields.push(field);
    groups.set(key, group);
  }
  return [...groups].map(([key, group]) => ({ key, ...group }));
}

/** An option group's values the person copied (SP-7): by field name, with each field's kind. */
export type CopiedGroup = {
  readonly group: string;
  readonly values: ReadonlyMap<string, { readonly kind: FieldKind; readonly value: unknown }>;
};

/**
 * One of a group header's icon buttons (SP-7), shown while the header is hovered or focused, the
 * keyboard's focus on it included. A 24 px square around its 14 px icon, as LF-18 asks of an icon
 * button (#1454): #1181's measurement missed it, as it's transparent until shown.
 */
function GroupButton({
  label,
  onClick,
  children,
}: {
  readonly label: string;
  readonly onClick: (() => void) | undefined;
  readonly children: ReactNode;
}) {
  return (
    <WithTooltip tooltip={label} disableable>
      <button
        type="button"
        aria-label={label}
        disabled={onClick === undefined}
        onClick={onClick}
        className={cn(
          "flex size-7 shrink-0 items-center justify-center rounded-sm text-muted-foreground",
          "opacity-0 group-hover/header:opacity-100 group-focus-within/header:opacity-100",
          "hover:bg-hover hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring",
          "disabled:pointer-events-none disabled:text-disabled [&_svg]:size-3.5",
        )}
      >
        {children}
      </button>
    </WithTooltip>
  );
}

/** Props of {@link FieldList}. */
type FieldListProps = Omit<EditPanelProps, "heading" | "fields"> & {
  readonly idPrefix: string;
  /** The tab the fields are on: its option groups are its own. */
  readonly tab: FieldGroup;
  readonly fields: readonly EditPanelField[];
  readonly query?: string;
  /** The option groups shown closed, as `tab:id`. */
  readonly closed: readonly string[];
  onToggle(key: string): void;
  /** Opens every group, or closes them all if all are open (Ctrl/Cmd + Enter). */
  onToggleAll(keys: readonly string[]): void;
  /** Each group's heading kept in view while its fields are, in a dialog (H3). */
  readonly stickyHeadings: boolean;
  /** The group copied last, from any element (SP-7). */
  readonly copied: CopiedGroup | null;
  onCopy(copied: CopiedGroup): void;
};

/** An Edit panel tab's fields, by option group (UX-13), each group closing, copying and resetting. */
export function FieldList({
  idPrefix,
  tab,
  fields,
  onChange,
  onChangeOn,
  onCommit,
  device,
  onReset,
  onResetToDefault,
  onPaste,
  groupActions,
  query = "",
  closed,
  onToggle,
  onToggleAll,
  copied,
  onCopy,
  stickyHeadings,
}: FieldListProps) {
  if (fields.length === 0) {
    return (
      <p className="p-3 text-xs text-muted-foreground">
        {query === "" ? t("editPanel.noFields") : t("editPanel.noMatches")}
      </p>
    );
  }
  const groups = optionGroupsOf(tab, fields);
  const all = groups.map(({ key }) => key);
  return (
    <div className="flex flex-col pb-2">
      {groups.map(({ key, id, label: name, fields: inGroup }, index) => {
        const actions = groupActions?.(id) ?? [];
        // Searching shows every group with a match open.
        const open = query !== "" || !closed.includes(key);
        const changed = inGroup.filter(resettable);
        // Marked as its fields are, with words for a screen reader (#1517).
        const dotted = inGroup.some(marked);
        const resetGroup =
          changed.length > 0 && onResetToDefault !== undefined
            ? () =>
                onResetToDefault(
                  changed.map((field) => field.name),
                  name,
                )
            : undefined;
        const bodyId = `${idPrefix}-group-${index}`;
        // Copy takes the group's values; paste sets those of them that this group has too, of the
        // same kind, and that can change now (SP-7). A line that leads elsewhere holds none.
        const copy = () =>
          onCopy({
            group: key,
            values: new Map(
              inGroup
                .filter((field) => field.kind !== "action")
                .map((field) => [field.name, { kind: field.kind, value: field.value }]),
            ),
          });
        const pasted =
          copied === null
            ? []
            : inGroup.filter(
                (field) =>
                  field.disabled !== true && copied.values.get(field.name)?.kind === field.kind,
              );
        const paste =
          onPaste === undefined || copied === null || pasted.length === 0
            ? undefined
            : () =>
                onPaste(
                  Object.fromEntries(
                    pasted.map((field) => [field.name, copied.values.get(field.name)?.value]),
                  ),
                  name,
                );
        return (
          <div key={key} className="border-b border-border" data-field-group="">
            <div
              data-field-group-heading=""
              className={cn(
                "group/header flex items-center gap-0.5 pr-1.5 hover:bg-hover",
                // In view at the top while its fields are, over them (H3); opaque, in the panel's
                // colour, as they pass under it.
                stickyHeadings &&
                  "sticky top-0 z-10 bg-panel shadow-[0_1px_0_var(--color-border)] hover:bg-[color-mix(in_oklab,var(--color-panel),var(--color-foreground)_6%)]",
              )}
            >
              <ContextMenu>
                <ContextMenuTrigger asChild>
                  <button
                    id={`${bodyId}-title`}
                    type="button"
                    aria-expanded={open}
                    aria-controls={open ? bodyId : undefined}
                    className={cn(
                      "flex h-7 min-w-0 flex-1 items-center gap-1 px-2 text-left text-base font-semibold",
                      "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
                      changed.length > 0 ? "text-ring" : "text-foreground",
                    )}
                    data-changed={changed.length > 0 ? "" : undefined}
                    aria-describedby={dotted ? `${bodyId}-changed` : undefined}
                    onClick={() => onToggle(key)}
                    onKeyDown={(event) => {
                      if (!(event.ctrlKey || event.metaKey)) return;
                      // Ctrl/Cmd + Enter opens or closes every group, Cmd + Esc resets this one
                      // (F-ED-27, UX-13). Not Ctrl + Esc: Windows opens the Start menu with it, and
                      // the group's right-click menu resets it there (#290).
                      if (event.key === "Enter") {
                        event.preventDefault();
                        onToggleAll(all);
                      } else if (
                        event.key === "Escape" &&
                        event.metaKey &&
                        resetGroup !== undefined
                      ) {
                        event.preventDefault();
                        event.stopPropagation();
                        resetGroup();
                      }
                    }}
                  >
                    <ChevronRightIcon
                      aria-hidden
                      className={cn("size-3.5 shrink-0 transition-transform", open && "rotate-90")}
                    />
                    {name}
                    {dotted ? (
                      <>
                        <ChangedDot />
                        <span id={`${bodyId}-changed`} hidden>
                          {t("editPanel.group.changed")}
                        </span>
                      </>
                    ) : null}
                  </button>
                </ContextMenuTrigger>
                <ContextMenuContent>
                  <ContextMenuItem disabled={resetGroup === undefined} onSelect={resetGroup}>
                    {t("editPanel.resetGroup")}
                  </ContextMenuItem>
                  <ContextMenuItem onSelect={() => onToggleAll(all)}>
                    {all.every((each) => !closed.includes(each))
                      ? t("editPanel.collapseAll")
                      : t("editPanel.expandAll")}
                  </ContextMenuItem>
                  {actions.length === 0 ? null : <ContextMenuSeparator />}
                  {actions.map((action) => (
                    <ContextMenuItem
                      key={action.label}
                      disabled={action.enabled === false}
                      onSelect={() => action.onSelect()}
                    >
                      {action.label}
                    </ContextMenuItem>
                  ))}
                </ContextMenuContent>
              </ContextMenu>
              <GroupButton label={t("editPanel.group.copy", { group: name })} onClick={copy}>
                <CopyIcon />
              </GroupButton>
              {onPaste === undefined ? null : (
                <GroupButton label={t("editPanel.group.paste", { group: name })} onClick={paste}>
                  <ClipboardPasteIcon />
                </GroupButton>
              )}
              {onResetToDefault === undefined ? null : (
                <GroupButton
                  label={t("editPanel.group.reset", { group: name })}
                  onClick={resetGroup}
                >
                  <RotateCcwIcon />
                </GroupButton>
              )}
            </div>
            {open ? (
              <div id={bodyId} className="flex flex-col gap-1.5 px-3 pt-1 pb-2.5">
                {inGroup.map((field) => (
                  <FieldRow
                    key={field.name}
                    idPrefix={idPrefix}
                    field={field}
                    onChange={onChange}
                    onChangeOn={onChangeOn}
                    onCommit={onCommit}
                    device={device}
                    onReset={onReset}
                    onResetToDefault={onResetToDefault}
                    query={query}
                  />
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
