import { t } from "@webforge/i18n";
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
import { type FieldRenderer, type FieldSpec, fieldRenderer } from "./field-registry.js";
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
};

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
   * Ctrl/Cmd + Esc. `what` names several ("spacing"), in lower case.
   */
  onResetToDefault?(names: readonly string[], what?: string): void;
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

const rendererFor = (kind: string) => fieldRenderer(kind) ?? BUILT_IN[kind];

function FieldList({
  idPrefix,
  fields,
  onChange,
  onCommit,
  device,
  onReset,
  onResetToDefault,
  query = "",
}: Omit<EditPanelProps, "heading"> & { readonly idPrefix: string; readonly query?: string }) {
  if (fields.length === 0) {
    return (
      <p className="p-3 text-xs text-muted-foreground">
        {query === "" ? t("editPanel.noFields") : t("editPanel.noMatches")}
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-3 p-3">
      {fields.map((field) => {
        const Renderer = rendererFor(field.kind) as FieldRenderer;
        const id = `${idPrefix}-${field.name}`;
        const labelId = `${id}-label`;
        const resetField =
          field.changed === true && onResetToDefault !== undefined
            ? () => onResetToDefault([field.name])
            : undefined;
        return (
          <ContextMenu key={field.name}>
            <ContextMenuTrigger asChild>
              <div className="flex flex-col gap-1" data-field={field.name}>
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
                <Renderer
                  id={id}
                  labelId={labelId}
                  field={field}
                  value={field.value}
                  onChange={(value) => onChange(field.name, value)}
                  onCommit={() => onCommit(field.name)}
                />
              </div>
            </ContextMenuTrigger>
            <ContextMenuContent>
              <ContextMenuItem disabled={resetField === undefined} onSelect={resetField}>
                {t("editPanel.resetField")}
              </ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
        );
      })}
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
  advanced = false,
  contentOnly = false,
  itemKey,
}: EditPanelProps) {
  const idPrefix = useId();
  // The search field's text (UX-13): the fields whose name has it are shown.
  const [query, setQuery] = useState("");
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
      rendererFor(field.kind) !== undefined &&
      (wanted === "" || field.label.toLocaleLowerCase().includes(wanted)),
  );
  const content = shown.filter((field) => field.group === "content");
  const style = shown.filter((field) => field.group === "style");
  const advancedFields = shown.filter((field) => field.group === "advanced");
  /** Ctrl/Cmd + Esc in a field resets it to the element's default (F-ED-27, UX-13). */
  const resetFromKeys = (
    event: KeyboardEvent<HTMLElement>,
    groupFields: readonly EditPanelField[],
  ) => {
    if (
      event.key !== "Escape" ||
      !(event.ctrlKey || event.metaKey) ||
      onResetToDefault === undefined
    ) {
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
        fields={groupFields}
        onChange={onChange}
        onCommit={onCommit}
        device={device}
        query={wanted}
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
