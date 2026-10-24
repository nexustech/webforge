import { t } from "@webforge/i18n";
import { ChevronRightIcon } from "lucide-react";
import { type KeyboardEvent, useId, useState } from "react";
import { cn } from "../../lib/cn.js";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "../ui/context-menu.js";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs.js";
import { BoxField } from "./box-field.js";
import { type FieldRenderer, type FieldSpec, useFieldRenderers } from "./field-registry.js";
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
  /**
   * The option group it is shown in (UX-13), by its kind if not given: `id` stays the same in every
   * language and is what closed groups are remembered by, `label` is translated. Not "section":
   * that is a part of a page (glossary).
   */
  readonly optionGroup?: OptionGroup;
};

/** An option group (UX-13): a stable id ("spacing") and its translated name ("Spacing"). */
export type OptionGroup = { readonly id: string; readonly label: string };

/** Props of {@link EditPanel}. */
export type EditPanelProps = {
  /** The selected element's name, such as "Heading"; undefined when nothing is selected. */
  readonly heading?: string | undefined;
  readonly fields: readonly EditPanelField[];
  onChange(name: string, value: unknown): void;
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

/** The renderers every Edit panel has; `registerFieldRenderer` adds kinds or replaces these. */
const BUILT_IN: Readonly<Record<string, FieldRenderer>> = {
  ...PLAIN_RENDERERS,
  list: ListField,
  box: BoxField,
};

const rendererFor = (registered: ReadonlyMap<string, FieldRenderer>, kind: string) =>
  registered.get(kind) ?? BUILT_IN[kind];

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
};

function FieldList({
  idPrefix,
  tab,
  fields,
  onChange,
  onCommit,
  device,
  onReset,
  onResetToDefault,
  query = "",
  closed,
  onToggle,
  onToggleAll,
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
        const changed = inGroup.filter((field) => field.changed === true);
        const resetGroup =
          changed.length > 0 && onResetToDefault !== undefined
            ? () =>
                onResetToDefault(
                  changed.map((field) => field.name),
                  name,
                )
            : undefined;
        const bodyId = `${idPrefix}-group-${index}`;
        return (
          <div key={key} className="border-b border-border">
            <ContextMenu>
              <ContextMenuTrigger asChild>
                <button
                  id={`${bodyId}-title`}
                  type="button"
                  aria-expanded={open}
                  aria-controls={open ? bodyId : undefined}
                  className={cn(
                    "flex h-7 w-full items-center gap-1 px-2 text-left text-xs font-semibold",
                    "hover:bg-hover focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
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
            {open ? (
              <div id={bodyId} className="flex flex-col gap-3 px-3 pt-1 pb-3">
                {inGroup.map((field) => (
                  <FieldRow
                    key={field.name}
                    idPrefix={idPrefix}
                    field={field}
                    onChange={onChange}
                    onCommit={onCommit}
                    device={device}
                    onReset={onReset}
                    onResetToDefault={onResetToDefault}
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

/** One field: its label, its per-device dot, and its renderer; the label's menu resets it. */
function FieldRow({
  idPrefix,
  field,
  onChange,
  onCommit,
  device,
  onReset,
  onResetToDefault,
}: {
  readonly idPrefix: string;
  readonly field: EditPanelField;
  readonly onChange: EditPanelProps["onChange"];
  readonly onCommit: EditPanelProps["onCommit"];
  readonly device: string | undefined;
  readonly onReset: EditPanelProps["onReset"] | undefined;
  readonly onResetToDefault: EditPanelProps["onResetToDefault"] | undefined;
}) {
  const registered = useFieldRenderers();
  const Renderer = rendererFor(registered, field.kind) as FieldRenderer;
  const id = `${idPrefix}-${field.name}`;
  const labelId = `${id}-label`;
  const helpId = field.help === undefined ? undefined : `${id}-help`;
  const resetField =
    field.changed === true && onResetToDefault !== undefined
      ? () => onResetToDefault([field.name])
      : undefined;
  return (
    <div className="flex flex-col gap-1" data-field={field.name}>
      {/* The menu is the label's: a right-click in a text field keeps its own (spelling, F-ED-19). */}
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div className="flex items-center gap-1.5">
            <label id={labelId} htmlFor={id} className="text-xs text-muted-foreground">
              {field.label}
            </label>
            {field.responsive === true || field.overridden === true ? (
              <DeviceDot
                label={field.label}
                device={device ?? ""}
                overridden={field.overridden === true}
                onClear={onReset === undefined ? undefined : () => onReset(field.name)}
              />
            ) : null}
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem disabled={resetField === undefined} onSelect={resetField}>
            {t("editPanel.resetField")}
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
      <Renderer
        id={id}
        labelId={labelId}
        {...(helpId === undefined ? {} : { helpId })}
        field={field}
        value={field.value}
        onChange={(value) => onChange(field.name, value)}
        onCommit={() => onCommit(field.name)}
      />
      {helpId === undefined ? null : (
        <p id={helpId} className="text-xs text-muted-foreground">
          {field.help}
        </p>
      )}
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
  onCommit,
  device,
  onReset,
  onResetToDefault,
  closedGroups,
  onClosedGroupsChange,
  advanced = false,
  contentOnly = false,
  itemKey,
}: EditPanelProps) {
  const idPrefix = useId();
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
  // A renderer registered after the panel was drawn (the app's image, link and colour fields)
  // redraws it, whatever else changes or doesn't.
  const registered = useFieldRenderers();
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
      rendererFor(registered, field.kind) !== undefined &&
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
    if (groupFields.some((field) => field.name === name && field.changed === true) && name) {
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
        onCommit={onCommit}
        device={device}
        query={wanted}
        closed={closed}
        onToggle={toggle}
        onToggleAll={toggleAll}
        {...(onResetToDefault === undefined ? {} : { onResetToDefault })}
        {...(onReset === undefined ? {} : { onReset })}
      />
    </TabsContent>
  );
  return (
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
  );
}
