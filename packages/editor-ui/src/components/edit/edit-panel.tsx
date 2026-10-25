import { t } from "@webforge/i18n";
import { ChevronRightIcon, ClipboardPasteIcon, CopyIcon, RotateCcwIcon } from "lucide-react";
import { type KeyboardEvent, type ReactNode, useId, useState } from "react";
import { cn } from "../../lib/cn.js";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "../ui/context-menu.js";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs.js";
import { BoxField } from "./box-field.js";
import { drawField, FieldRenderersProvider, useFieldRenderers } from "./field-context.js";
import type { FieldKind, FieldRenderers, FieldSpec } from "./field-spec.js";
import { ListField } from "./list-field.js";
import { PLAIN_RENDERERS } from "./plain-renderers.js";
import { fieldControlClass } from "./text-field.js";

/**
 * Which tab a field belongs on: Content for what it says, Style for how it looks, Advanced for
 * classes, attributes and the anchor (Advanced mode only, F-ED-11).
 */
export type FieldGroup = "content" | "style" | "advanced";

/** One field of the selected element, with its current value. */
export type EditPanelField = FieldSpec & {
  readonly name: string;
  readonly group: FieldGroup;
  /** The value for the device being viewed. */
  readonly value: unknown;
  /**
   * The value may differ per device (F-ED-4) and a device other than Desktop is shown: the field
   * gets a dot saying whether it has a value of its own there (UX-19).
   */
  readonly responsive?: boolean;
  /** The value is set for this device only, overriding Desktop's (F-ED-4). */
  readonly overridden?: boolean;
  /** The value differs from the element's default, so it can be reset (UX-18). */
  readonly changed?: boolean;
  /** The field can't be changed now: shown greyed out. */
  readonly disabled?: boolean;
  /** Why its value isn't acceptable (translated), shown under its control. */
  readonly error?: string;
  /**
   * Its value on each device, for a field that may differ per device (SP-5): expanding it shows a
   * row per device, in this order.
   */
  readonly devices?: readonly DeviceValue[];
  /**
   * The option group it is shown in (UX-13), by its kind if not given: `id` stays the same in every
   * language and is what closed groups are remembered by, `label` is translated. Not "section":
   * that is a part of a page (glossary).
   */
  readonly optionGroup?: OptionGroup;
};

/** A field's value on one device (SP-5). */
type DeviceValue = {
  /** The device's id ("tablet"), as the app's {@link EditPanelProps.onChangeOn} takes it. */
  readonly id: string;
  /** Its name, translated ("Tablet"). */
  readonly label: string;
  readonly value: unknown;
  /** It has a value of its own: Desktop always, Tablet or Mobile once set there. */
  readonly own: boolean;
  /** The device shown on the canvas takes its value from this one. */
  readonly inEffect: boolean;
};

/** An option group (UX-13): a stable id ("spacing") and its translated name ("Spacing"). */
export type OptionGroup = { readonly id: string; readonly label: string };

/** Props of {@link EditPanel}. */
export type EditPanelProps = {
  /** The selected element's name, such as "Heading"; undefined when nothing is selected. */
  readonly heading?: string | undefined;
  readonly fields: readonly EditPanelField[];
  onChange(name: string, value: unknown): void;
  /**
   * The value of field `name` on device `device` (a {@link DeviceValue}'s id) changed, in its row
   * of the device rows (SP-5); `onCommit` ends the run as for `onChange`.
   */
  onChangeOn?(name: string, device: string, value: unknown): void;
  /** The user is done with a field (it lost focus, or a choice was made). */
  onCommit(name: string): void;
  /** The device being viewed, translated ("Mobile"), named in the override marker. */
  readonly device?: string | undefined;
  /** Drops a field's override, so the device uses the Desktop value again. */
  onReset?(name: string): void;
  /**
   * Resets fields to the element's defaults, as one step (UX-13): one from its right-click menu or
   * Ctrl/Cmd + Esc, or an option group's changed fields, `group` naming it ("Spacing").
   */
  onResetToDefault?(names: readonly string[], group?: string): void;
  /**
   * Sets fields to `values`, by name, as one step: an option group's values copied from this or
   * another element (SP-7), `group` naming it ("Spacing"). No paste without it.
   */
  onPaste?(values: Readonly<Record<string, unknown>>, group: string): void;
  /**
   * The option groups shown closed, as `tab:id` ("style:spacing"), and how to change them: the app
   * remembers them per person (UX-13). By id, so a new language or name keeps them; per tab, as
   * each tab has its own groups. Without them the panel keeps its own, all open at first.
   */
  readonly closedGroups?: readonly string[] | undefined;
  onClosedGroupsChange?(closed: readonly string[]): void;
  /** Shows the Advanced tab and its fields (Advanced mode, F-ED-11). */
  readonly advanced?: boolean | undefined;
  /** Shows the Content tab only, without Style and Advanced (Content mode, M3). */
  readonly contentOnly?: boolean | undefined;
  /**
   * Which element the fields are for (its id). The fields start afresh for another element, so
   * nothing typed for one (an unfinished anchor) shows up on the next.
   */
  readonly itemKey?: string | undefined;
};

/**
 * A field's per-device dot (UX-19): grey while the device shown uses Desktop's value, the accent
 * colour once it has its own. A dot in the accent colour clears it (`onClear`): the device uses
 * Desktop's value again.
 */
function DeviceDot({
  label,
  device,
  overridden,
  onClear,
}: {
  readonly label: string;
  readonly device: string;
  readonly overridden: boolean;
  readonly onClear: (() => void) | undefined;
}) {
  const dot = (
    <span
      aria-hidden
      className={cn("block size-2 rounded-full", overridden ? "bg-ring" : "bg-muted-foreground/40")}
    />
  );
  if (!overridden || onClear === undefined) {
    const title = overridden
      ? t("editPanel.dot.set", { device, field: label })
      : t("editPanel.dot.inherits", { device, field: label });
    return (
      <span
        role="img"
        aria-label={title}
        title={title}
        className="p-1"
        data-device-dot={overridden ? "set" : "inherits"}
      >
        {dot}
      </span>
    );
  }
  const title = t("editPanel.dot.clear", { device, field: label });
  return (
    <button
      type="button"
      aria-label={title}
      title={title}
      className="rounded-full p-1 hover:bg-hover focus-visible:outline-2 focus-visible:outline-ring"
      data-device-dot="set"
      onClick={onClear}
    >
      {dot}
    </button>
  );
}

/**
 * The renderers every Edit panel has; the ones the app gives it ({@link FieldRenderersProvider})
 * add kinds or replace these.
 */
const BUILT_IN: FieldRenderers = { ...PLAIN_RENDERERS, list: ListField, box: BoxField };

/** Whether every Edit panel draws fields of `kind` itself, without the app giving it a renderer. */
export function hasBuiltInRenderer(kind: FieldKind): boolean {
  return BUILT_IN[kind] !== undefined;
}

/**
 * `label` with the part the search found in it marked (SP-6), in the case the label has it; the
 * label as it is when the search is empty or isn't in it.
 */
function withMatch(label: string, query: string): ReactNode {
  const at = query === "" ? -1 : label.toLocaleLowerCase().indexOf(query);
  if (at < 0) return label;
  return (
    <>
      {label.slice(0, at)}
      <mark className="rounded-xs bg-ring/25 text-foreground">
        {label.slice(at, at + query.length)}
      </mark>
      {label.slice(at + query.length)}
    </>
  );
}

/** A field the person can reset to its default: changed, and not disabled (R11). */
const resettable = (field: EditPanelField) => field.changed === true && field.disabled !== true;

/** The groups of fields that name none (UX-13), by kind; each id is its translation key's. */
type FallbackGroup =
  | "advanced"
  | "image"
  | "link"
  | "items"
  | "spacing"
  | "colours"
  | "text"
  | "appearance";

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
      return fallbackGroup(field.group === "content" ? "text" : "appearance");
    default:
      return fallbackGroup("text");
  }
}

/**
 * `fields` by option group, in the order each group's first field comes. A group is known as
 * `tab:id`: each tab's groups are its own, so closing Style's Text leaves Content's open.
 */
function optionGroupsOf(tab: FieldGroup, fields: readonly EditPanelField[]) {
  const groups = new Map<string, { label: string; fields: EditPanelField[] }>();
  for (const field of fields) {
    const { id, label } = optionGroupOf(field);
    const key = `${tab}:${id}`;
    const group = groups.get(key) ?? { label, fields: [] };
    group.fields.push(field);
    groups.set(key, group);
  }
  return [...groups].map(([key, group]) => ({ key, ...group }));
}

/** An option group's values the person copied (SP-7): by field name, with each field's kind. */
type CopiedGroup = {
  readonly group: string;
  readonly values: ReadonlyMap<string, { readonly kind: FieldKind; readonly value: unknown }>;
};

/** One of a group header's icon buttons (SP-7), shown while the header is hovered or focused. */
function GroupAction({
  label,
  onClick,
  children,
}: {
  readonly label: string;
  readonly onClick: (() => void) | undefined;
  readonly children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={onClick === undefined}
      onClick={onClick}
      className={cn(
        "flex size-5 shrink-0 items-center justify-center rounded-sm text-muted-foreground",
        "opacity-0 group-hover/header:opacity-100 group-focus-within/header:opacity-100",
        "hover:bg-hover hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring",
        "disabled:pointer-events-none disabled:text-disabled [&_svg]:size-3.5",
      )}
    >
      {children}
    </button>
  );
}

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
  /** The group copied last, from any element (SP-7). */
  readonly copied: CopiedGroup | null;
  onCopy(copied: CopiedGroup): void;
};

function FieldList({
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
  query = "",
  closed,
  onToggle,
  onToggleAll,
  copied,
  onCopy,
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
      {groups.map(({ key, label: name, fields: inGroup }, index) => {
        // Searching shows every group with a match open.
        const open = query !== "" || !closed.includes(key);
        const changed = inGroup.filter(resettable);
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
        // same kind, and that can change now (SP-7).
        const copy = () =>
          onCopy({
            group: key,
            values: new Map(
              inGroup.map((field) => [field.name, { kind: field.kind, value: field.value }]),
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
          <div key={key} className="border-b border-border">
            <div className="group/header flex items-center gap-0.5 pr-1.5 hover:bg-hover">
              <ContextMenu>
                <ContextMenuTrigger asChild>
                  <button
                    id={`${bodyId}-title`}
                    type="button"
                    aria-expanded={open}
                    aria-controls={open ? bodyId : undefined}
                    className={cn(
                      "flex h-7 min-w-0 flex-1 items-center gap-1 px-2 text-left text-xs font-semibold",
                      "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
                      changed.length > 0 ? "text-ring" : "text-foreground",
                    )}
                    data-changed={changed.length > 0 ? "" : undefined}
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
                </ContextMenuContent>
              </ContextMenu>
              <GroupAction label={t("editPanel.group.copy", { group: name })} onClick={copy}>
                <CopyIcon />
              </GroupAction>
              {onPaste === undefined ? null : (
                <GroupAction label={t("editPanel.group.paste", { group: name })} onClick={paste}>
                  <ClipboardPasteIcon />
                </GroupAction>
              )}
              {onResetToDefault === undefined ? null : (
                <GroupAction
                  label={t("editPanel.group.reset", { group: name })}
                  onClick={resetGroup}
                >
                  <RotateCcwIcon />
                </GroupAction>
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

/**
 * Kinds whose control needs the panel's width (LF-7): their label sits above them, not beside.
 * Lists, spacing boxes, images and a paragraph of text.
 */
const isWide = (field: EditPanelField) =>
  field.kind === "list" ||
  field.kind === "box" ||
  field.kind === "image" ||
  field.kind === "imageChoice" ||
  field.kind === "multiChoice" ||
  (field.kind === "text" && field.multiline === true);

/**
 * One field (LF-7): its muted label on the left, about two fifths of the row, with its per-device
 * dot, and its control filling the right, in 24 px rows; a wide control under its label instead.
 * The label's menu resets it.
 */
function FieldRow({
  idPrefix,
  field,
  onChange,
  onChangeOn,
  onCommit,
  device,
  onReset,
  onResetToDefault,
  query,
}: {
  readonly idPrefix: string;
  readonly field: EditPanelField;
  readonly onChangeOn: EditPanelProps["onChangeOn"] | undefined;
  /** The search's text, lower case: the part of the label it found is marked (SP-6). */
  readonly query: string;
  readonly onChange: EditPanelProps["onChange"];
  readonly onCommit: EditPanelProps["onCommit"];
  readonly device: string | undefined;
  readonly onReset: EditPanelProps["onReset"] | undefined;
  readonly onResetToDefault: EditPanelProps["onResetToDefault"] | undefined;
}) {
  const renderers = useFieldRenderers();
  const id = `${idPrefix}-${field.name}`;
  const labelId = `${id}-label`;
  const helpId = field.help === undefined ? undefined : `${id}-help`;
  const errorId = field.error === undefined ? undefined : `${id}-error`;
  const resetField =
    resettable(field) && onResetToDefault !== undefined
      ? () => onResetToDefault([field.name])
      : undefined;
  const wide = isWide(field);
  // Its rows per device, open or not (SP-5).
  const [perDevice, setPerDevice] = useState(false);
  const devices =
    field.devices !== undefined && field.devices.length > 1 && onChangeOn !== undefined
      ? field.devices
      : undefined;
  const devicesId = `${id}-devices`;
  return (
    <div
      className={cn(
        wide
          ? "flex flex-col gap-1"
          : "grid min-h-6 grid-cols-[minmax(0,2fr)_minmax(0,3fr)] items-center gap-x-2 gap-y-1",
      )}
      data-field={field.name}
    >
      {/* The menu is the label's: a right-click in a text field keeps its own (spelling, F-ED-19). */}
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div className="flex min-w-0 items-center gap-1">
            <label
              id={labelId}
              htmlFor={id}
              title={field.label}
              className="truncate text-xs text-muted-foreground"
            >
              {withMatch(field.label, query)}
            </label>
            {field.responsive === true || field.overridden === true ? (
              <DeviceDot
                label={field.label}
                device={device ?? ""}
                overridden={field.overridden === true}
                onClear={
                  onReset === undefined || field.disabled === true
                    ? undefined
                    : () => onReset(field.name)
                }
              />
            ) : null}
            {devices === undefined ? null : (
              <button
                type="button"
                aria-expanded={perDevice}
                aria-controls={perDevice ? devicesId : undefined}
                aria-label={t("editPanel.devices.show", { field: field.label })}
                title={t("editPanel.devices.show", { field: field.label })}
                className="ml-auto shrink-0 rounded-sm p-0.5 text-muted-foreground hover:bg-hover focus-visible:outline-2 focus-visible:outline-ring"
                onClick={() => setPerDevice(!perDevice)}
              >
                <ChevronRightIcon
                  aria-hidden
                  className={cn("size-3 transition-transform", perDevice && "rotate-90")}
                />
              </button>
            )}
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem disabled={resetField === undefined} onSelect={resetField}>
            {t("editPanel.resetField")}
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
      <div className="min-w-0">
        {drawField(renderers, field.kind, {
          id,
          labelId,
          ...(helpId === undefined ? {} : { helpId }),
          ...(errorId === undefined ? {} : { errorId }),
          ...(field.disabled === true ? { disabled: true } : {}),
          field,
          value: field.value,
          onChange: (value) => onChange(field.name, value),
          onCommit: () => onCommit(field.name),
        })}
      </div>
      {/* Under the control, in its column. */}
      {errorId === undefined ? null : (
        <p id={errorId} className={cn("text-2xs text-destructive-text", !wide && "col-start-2")}>
          {field.error}
        </p>
      )}
      {helpId === undefined ? null : (
        <p id={helpId} className={cn("text-xs text-muted-foreground", !wide && "col-start-2")}>
          {field.help}
        </p>
      )}
      {devices === undefined || !perDevice ? null : (
        <fieldset
          id={devicesId}
          aria-label={t("editPanel.devices.show", { field: field.label })}
          className={cn(
            "m-0 flex min-w-0 flex-col gap-1 border-0 border-l-2 border-border p-0 pl-2",
            !wide && "col-span-2",
          )}
        >
          {devices.map((each) => (
            <DeviceRow
              key={each.id}
              id={`${id}-${each.id}`}
              field={field}
              device={each}
              onChange={(value) => onChangeOn?.(field.name, each.id, value)}
              onCommit={() => onCommit(field.name)}
            />
          ))}
        </fieldset>
      )}
    </div>
  );
}

/**
 * One device's row of a field (SP-5): the device's name, in the accent where it has a value of its
 * own, the dot on the device whose value the device shown takes, and the control for its value.
 */
function DeviceRow({
  id,
  field,
  device,
  onChange,
  onCommit,
}: {
  readonly id: string;
  readonly field: EditPanelField;
  readonly device: DeviceValue;
  readonly onChange: (value: unknown) => void;
  readonly onCommit: () => void;
}) {
  const renderers = useFieldRenderers();
  const labelId = `${id}-label`;
  return (
    <div
      className="grid min-h-6 grid-cols-[minmax(0,2fr)_minmax(0,3fr)] items-center gap-x-2"
      data-device={device.id}
    >
      <div className="flex min-w-0 items-center gap-1">
        <label
          id={labelId}
          htmlFor={id}
          className={cn(
            "truncate text-xs",
            device.own ? "font-semibold text-ring" : "text-muted-foreground",
          )}
        >
          {device.label}
          {device.own ? (
            <span className="sr-only">{`, ${t("editPanel.devices.own", { device: device.label })}`}</span>
          ) : null}
        </label>
        {device.inEffect ? (
          <span
            role="img"
            aria-label={t("editPanel.devices.inEffect")}
            title={t("editPanel.devices.inEffect")}
            className="p-1"
          >
            <span aria-hidden className="block size-2 rounded-full bg-ring" />
          </span>
        ) : null}
      </div>
      <div className="min-w-0">
        {drawField(renderers, field.kind, {
          id,
          labelId,
          ...(field.disabled === true ? { disabled: true } : {}),
          field,
          value: device.value,
          onChange,
          onCommit,
        })}
      </div>
    </div>
  );
}

/**
 * The Edit panel (1.14): the selected element's fields on a Content and a Style tab, each drawn
 * by its kind's renderer. It only shows and reports; the app records each change in the history.
 */
export function EditPanel({
  heading,
  fields,
  onChange,
  onChangeOn,
  onCommit,
  device,
  onReset,
  onResetToDefault,
  onPaste,
  closedGroups,
  onClosedGroupsChange,
  advanced = false,
  contentOnly = false,
  itemKey,
}: EditPanelProps) {
  const idPrefix = useId();
  // The option group copied last (SP-7): kept while other elements are selected, to paste there.
  const [copied, setCopied] = useState<CopiedGroup | null>(null);
  // The search field's text (UX-13): the fields whose name has it are shown. It is the element's:
  // selecting another starts with every field shown.
  const [search, setSearch] = useState({ itemKey, text: "" });
  const query = search.itemKey === itemKey ? search.text : "";
  const setQuery = (text: string) => setSearch({ itemKey, text });
  // The option groups the person closed (UX-13): the app's, else the panel's own.
  const [ownClosed, setOwnClosed] = useState<readonly string[]>([]);
  const closed = closedGroups ?? ownClosed;
  const setClosed = (next: readonly string[]) => {
    if (onClosedGroupsChange === undefined) setOwnClosed(next);
    else onClosedGroupsChange(next);
  };
  const toggle = (key: string) =>
    setClosed(closed.includes(key) ? closed.filter((each) => each !== key) : [...closed, key]);
  const toggleAll = (keys: readonly string[]) =>
    setClosed(
      keys.every((key) => !closed.includes(key))
        ? [...closed, ...keys]
        : closed.filter((key) => !keys.includes(key)),
    );
  // The app's renderers over the built-in ones, for its fields and its lists' items.
  const renderers: FieldRenderers = { ...BUILT_IN, ...useFieldRenderers() };
  if (heading === undefined) {
    return (
      <p className="flex h-full items-center justify-center p-4 text-center text-xs text-muted-foreground">
        {t("editPanel.empty")}
      </p>
    );
  }
  const wanted = query.trim().toLocaleLowerCase();
  const shown = fields.filter(
    (field) =>
      renderers[field.kind] !== undefined &&
      (wanted === "" || field.label.toLocaleLowerCase().includes(wanted)),
  );
  const content = shown.filter((field) => field.group === "content");
  const style = shown.filter((field) => field.group === "style");
  const advancedFields = shown.filter((field) => field.group === "advanced");
  /**
   * Cmd + Esc in a field resets it to the element's default (F-ED-27, UX-13), on a Mac only:
   * Windows opens the Start menu with Ctrl + Esc (#290).
   */
  const resetFromKeys = (
    event: KeyboardEvent<HTMLElement>,
    groupFields: readonly EditPanelField[],
  ) => {
    if (event.key !== "Escape" || !event.metaKey || onResetToDefault === undefined) {
      return;
    }
    const name = (event.target as Element).closest("[data-field]")?.getAttribute("data-field");
    if (groupFields.some((field) => field.name === name && resettable(field)) && name) {
      event.preventDefault();
      event.stopPropagation();
      onResetToDefault([name]);
    }
  };
  const list = (group: FieldGroup, groupFields: readonly EditPanelField[]) => (
    <TabsContent
      value={group}
      className="overflow-auto"
      onKeyDown={(event) => resetFromKeys(event, groupFields)}
    >
      <FieldList
        key={itemKey}
        idPrefix={`${idPrefix}${group}`}
        tab={group}
        fields={groupFields}
        onChange={onChange}
        {...(onChangeOn === undefined ? {} : { onChangeOn })}
        onCommit={onCommit}
        device={device}
        query={wanted}
        closed={closed}
        onToggle={toggle}
        onToggleAll={toggleAll}
        copied={copied}
        onCopy={setCopied}
        {...(onResetToDefault === undefined ? {} : { onResetToDefault })}
        {...(onPaste === undefined ? {} : { onPaste })}
        {...(onReset === undefined ? {} : { onReset })}
      />
    </TabsContent>
  );
  return (
    <FieldRenderersProvider renderers={renderers}>
      <div className="flex h-full flex-col">
        <h2 className="truncate px-3 pt-2 text-sm font-semibold text-foreground">{heading}</h2>
        <div className="px-3 pt-2">
          <input
            type="search"
            aria-label={t("editPanel.search")}
            placeholder={t("editPanel.searchPlaceholder")}
            value={query}
            className={cn(fieldControlClass, "h-7 w-full px-2 text-xs")}
            onChange={(event) => setQuery(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape" && query !== "") {
                event.stopPropagation();
                setQuery("");
              }
            }}
          />
        </div>
        <Tabs
          // Keyed by the element's type: the tab stays while moving between elements of one type, and
          // another type starts on its first tab with fields.
          key={`${heading}${contentOnly ? ":content" : ""}`}
          defaultValue={
            contentOnly || content.length > 0
              ? "content"
              : style.length > 0
                ? "style"
                : advanced && advancedFields.length > 0
                  ? "advanced"
                  : "content"
          }
          className="min-h-0 flex-1"
        >
          <TabsList aria-label={t("editPanel.tabs")}>
            <TabsTrigger value="content">{t("editPanel.content")}</TabsTrigger>
            {contentOnly ? null : <TabsTrigger value="style">{t("editPanel.style")}</TabsTrigger>}
            {advanced && !contentOnly ? (
              <TabsTrigger value="advanced">{t("editPanel.advanced")}</TabsTrigger>
            ) : null}
          </TabsList>
          {list("content", content)}
          {contentOnly ? null : list("style", style)}
          {advanced && !contentOnly ? list("advanced", advancedFields) : null}
        </Tabs>
      </div>
    </FieldRenderersProvider>
  );
}
